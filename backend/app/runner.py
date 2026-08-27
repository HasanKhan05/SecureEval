from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.enums import JobStatus, Mode, StrategyId
from app.llm.client import LlmClient
from app.models import RunRecord
from app.repairs import repair_source
from app.reports import build_report, save_report
from app.schemas import Finding, LlmUsage, StrategyResult, TestExecution, ToolStatus
from app.scoring import EvidenceSnapshot, score_strategy
from app.tools.bandit import run_bandit
from app.tools.pytest_runner import run_pytest
from app.tools.semgrep import run_semgrep


@dataclass(frozen=True)
class RunnerDependencies:
    fixture_root: Path
    work_root: Path
    tool_timeout_seconds: float
    llm_client: LlmClient


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _progress(record: RunRecord) -> dict[str, object]:
    return json.loads(record.progress_json or "{}")


def _scan_status(*statuses: ToolStatus) -> ToolStatus:
    if all(status == "completed" for status in statuses):
        return "completed"
    for status in ("cancelled", "timeout", "unavailable"):
        if status in statuses:
            return status
    return "failed"


def _set_stage(
    session: Session,
    record: RunRecord,
    stage: str,
    *,
    completed_stage: str | None = None,
    extra: dict[str, object] | None = None,
) -> None:
    payload = _progress(record)
    completed = list(payload.get("completed_stages", []))
    if completed_stage and completed_stage not in completed:
        completed.append(completed_stage)
    payload["completed_stages"] = completed
    if extra:
        payload.update(extra)
    record.stage = stage
    record.progress_json = json.dumps(payload, separators=(",", ":"))
    record.updated_at = _now()
    session.commit()


def _fail(
    session_factory: sessionmaker[Session],
    run_id: str,
    code: str,
    message: str,
) -> None:
    with session_factory() as session:
        record = session.get(RunRecord, run_id)
        if record is None or record.status == JobStatus.CANCELLED.value:
            return
        record.status = JobStatus.FAILED.value
        record.stage = "failed"
        record.failure_code = code
        record.failure_message = message[:256]
        record.updated_at = _now()
        for attempt in record.attempts:
            if attempt.status != JobStatus.COMPLETED.value:
                attempt.status = JobStatus.FAILED.value
                attempt.failure_code = code
        session.commit()


def _cancelled(session: Session, run_id: str) -> bool:
    session.expire_all()
    record = session.get(RunRecord, run_id)
    return record is None or record.status == JobStatus.CANCELLED.value


def execute_baseline(
    run_id: str,
    session_factory: sessionmaker[Session],
    dependencies: RunnerDependencies,
) -> None:
    run_work = dependencies.work_root / run_id
    try:
        baseline_work = run_work / "baseline"
        baseline_work.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(dependencies.fixture_root, baseline_work)
        source_path = baseline_work / "source"
        tests_path = baseline_work / "tests"
        source = (source_path / "app.py").read_text(encoding="utf-8")

        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            if record is None or record.status != JobStatus.RUNNING.value:
                return
            selected_categories = set(json.loads(record.scan_categories_json))
            _set_stage(session, record, "baseline_testing")
        tests = run_pytest(tests_path, source_path, dependencies.tool_timeout_seconds)

        with session_factory() as session:
            if _cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            _set_stage(
                session,
                record,
                "baseline_scanning",
                completed_stage="baseline_testing",
            )
        bandit = run_bandit(source_path, dependencies.tool_timeout_seconds)
        semgrep = run_semgrep(source_path, dependencies.tool_timeout_seconds)
        if tests.status != "completed" or bandit.status != "completed" or semgrep.status != "completed":
            raise RuntimeError("A baseline analysis tool did not complete.")
        scan_status = _scan_status(bandit.status, semgrep.status)
        findings = [
            item
            for item in [*bandit.findings, *semgrep.findings]
            if item.category.value in selected_categories
        ]

        with session_factory() as session:
            if _cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            for attempt in record.attempts:
                attempt.status = JobStatus.QUEUED.value
            _set_stage(
                session,
                record,
                "awaiting_strategy",
                completed_stage="baseline_scanning",
                extra={
                    "baseline_source": source,
                    "baseline_findings": [
                        item.model_dump(mode="json") for item in findings
                    ],
                    "baseline_tests": tests.model_dump(mode="json"),
                    "baseline_scan_status": scan_status,
                    "current_strategy": None,
                },
            )
    except Exception as exc:
        _fail(session_factory, run_id, "baseline_failed", str(exc))


def execute_repairs(
    run_id: str,
    session_factory: sessionmaker[Session],
    dependencies: RunnerDependencies,
) -> None:
    run_work = dependencies.work_root / run_id
    try:
        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            if record is None or record.status != JobStatus.RUNNING.value:
                return
            progress = _progress(record)
            baseline_source = str(progress["baseline_source"])
            baseline_findings = [
                Finding.model_validate(item)
                for item in progress["baseline_findings"]
            ]
            baseline_tests = TestExecution.model_validate(
                progress["baseline_tests"]
            )
            baseline_scan_status = progress.get("baseline_scan_status", "completed")
            selected_categories = set(json.loads(record.scan_categories_json))
            attempts = [
                (item.attempt_id, item.strategy_id) for item in record.attempts
            ]
            mode = Mode(record.mode)

        results: list[StrategyResult] = []
        for attempt_id, strategy_value in attempts:
            with session_factory() as session:
                if _cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                _set_stage(
                    session,
                    record,
                    "repairing",
                    extra={"current_strategy": strategy_value},
                )

            attempt_work = run_work / attempt_id
            shutil.copytree(dependencies.fixture_root, attempt_work)
            source_path = attempt_work / "source"
            tests_path = attempt_work / "tests"
            source_file = source_path / "app.py"
            strategy_id = StrategyId(strategy_value)
            repair = repair_source(
                strategy_id,
                baseline_source,
                baseline_findings,
                baseline_tests,
                dependencies.llm_client,
            )
            if repair.value is None:
                raise RuntimeError(f"Repair unavailable for {strategy_value}.")
            source_file.write_text(repair.value.repaired_code, encoding="utf-8")

            with session_factory() as session:
                if _cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                _set_stage(
                    session,
                    record,
                    "repaired_testing",
                    completed_stage="repairing",
                )
            repaired_tests = run_pytest(
                tests_path, source_path, dependencies.tool_timeout_seconds
            )

            with session_factory() as session:
                if _cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                _set_stage(
                    session,
                    record,
                    "repaired_scanning",
                    completed_stage="repaired_testing",
                )
            bandit = run_bandit(source_path, dependencies.tool_timeout_seconds)
            semgrep = run_semgrep(source_path, dependencies.tool_timeout_seconds)
            repaired_findings = [
                item
                for item in [*bandit.findings, *semgrep.findings]
                if item.category.value in selected_categories
            ]
            scan_status = _scan_status(bandit.status, semgrep.status)
            metrics = score_strategy(
                EvidenceSnapshot(
                    len(baseline_findings),
                    baseline_tests.status,
                    baseline_tests.passed,
                    baseline_tests.failed,
                ),
                EvidenceSnapshot(
                    len(repaired_findings),
                    repaired_tests.status,
                    repaired_tests.passed,
                    repaired_tests.failed,
                    repair.estimated_cost_usd,
                    repair.latency_ms,
                    scan_status,
                ),
            )
            usage = LlmUsage(
                source=repair.source,
                provider=repair.provider,
                model=repair.model,
                status=repair.status,
                input_tokens=repair.input_tokens,
                output_tokens=repair.output_tokens,
                estimated_cost_usd=repair.estimated_cost_usd,
                latency_ms=repair.latency_ms,
                retries=repair.retries,
            )
            results.append(
                StrategyResult(
                    attempt_id=attempt_id,
                    strategy_id=strategy_id,
                    status=JobStatus.COMPLETED,
                    repaired_code=repair.value.repaired_code,
                    repair_summary=repair.value.summary,
                    limitations=repair.value.limitations,
                    repaired_findings=repaired_findings,
                    repaired_scan_status=scan_status,
                    repaired_tests=repaired_tests,
                    llm_usage=usage,
                    review=(
                        "The candidate was rescanned and its configured functional "
                        "tests were rerun. These checks are not a security guarantee."
                    ),
                    metrics=metrics,
                )
            )
            with session_factory() as session:
                record = session.get(RunRecord, run_id)
                matching = next(
                    item for item in record.attempts if item.attempt_id == attempt_id
                )
                matching.status = JobStatus.COMPLETED.value
                session.commit()

        with session_factory() as session:
            if _cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            _set_stage(
                session,
                record,
                "reviewing",
                completed_stage="repaired_scanning",
            )
            _set_stage(session, record, "reporting", completed_stage="reviewing")
            report = build_report(
                run_id=run_id,
                mode=mode,
                baseline_source=baseline_source,
                baseline_findings=baseline_findings,
                baseline_scan_status=baseline_scan_status,
                baseline_tests=baseline_tests,
                strategy_results=results,
                explanation=(
                    "SecureEval compared recorded scanner findings, functional test "
                    "outcomes, cost, and latency using deterministic metrics."
                ),
                explanation_source="local_fallback",
                limitations=[
                    "This portfolio run uses the controlled T-01 benchmark fixture.",
                    "Static analysis and sample tests are not a security guarantee.",
                ],
                created_at=datetime.now(UTC),
            )
            save_report(session, report)
    except Exception as exc:
        _fail(session_factory, run_id, "repair_pipeline_failed", str(exc))
    finally:
        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            terminal = record is None or record.status in {
                JobStatus.COMPLETED.value,
                JobStatus.FAILED.value,
                JobStatus.CANCELLED.value,
            }
        if terminal:
            shutil.rmtree(run_work, ignore_errors=True)
