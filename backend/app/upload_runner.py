from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.enums import JobStatus, Mode, StrategyId
from app.llm.contracts import LlmResult, RepairProposal
from app.models import RunRecord
from app.repairs import repair_source
from app.reports import build_report, save_report
from app.runner_support import (
    RunnerDependencies,
    cleanup_run,
    combined_scan_status,
    fail_run,
    progress_payload,
    run_cancelled,
    set_stage,
)
from app.schemas import Finding, LlmUsage, StrategyResult, SyntaxValidation, TestExecution
from app.scoring import StaticEvidenceSnapshot, score_static_strategy
from app.static_evidence import unavailable_functional_tests, validate_python_syntax
from app.tools.bandit import ScanResult, run_bandit
from app.tools.semgrep import run_semgrep
from app.upload_source import UploadSourceError, load_uploaded_python

MAX_REPAIRED_SOURCE_CHARS = 200_000


def _is_terminal(
    session_factory: sessionmaker[Session],
    run_id: str,
) -> bool:
    with session_factory() as session:
        record = session.get(RunRecord, run_id)
        return record is None or record.status in {
            JobStatus.COMPLETED.value,
            JobStatus.FAILED.value,
            JobStatus.CANCELLED.value,
        }


def _cleanup_if_terminal(
    session_factory: sessionmaker[Session],
    dependencies: RunnerDependencies,
    run_id: str,
) -> None:
    if _is_terminal(session_factory, run_id):
        cleanup_run(dependencies, run_id)


def _trusted_source_directory(path: Path, trusted_root: Path) -> Path:
    resolved = path.resolve(strict=True)
    if not resolved.is_dir() or not resolved.is_relative_to(trusted_root.resolve()):
        raise RuntimeError("untrusted_source_directory")
    return resolved


def _run_static_scanners(
    source_path: Path,
    dependencies: RunnerDependencies,
) -> tuple[ScanResult, ScanResult]:
    trusted_source = _trusted_source_directory(source_path, dependencies.work_root)
    bandit = run_bandit(trusted_source, dependencies.tool_timeout_seconds)
    semgrep = run_semgrep(trusted_source, dependencies.tool_timeout_seconds)
    return bandit, semgrep


def _filtered_findings(
    bandit: ScanResult,
    semgrep: ScanResult,
    selected_categories: set[str],
) -> list[Finding]:
    return [
        item
        for item in [*bandit.findings, *semgrep.findings]
        if item.category.value in selected_categories
    ]


def _syntax_failure_message(syntax: SyntaxValidation) -> str:
    location = f"line {syntax.line}, column {syntax.column}"
    return f"Invalid Python syntax at {location}: {syntax.message}"


def execute_upload_baseline(
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
            if record.upload_id is None:
                raise UploadSourceError("upload_id_missing")
            upload_id = record.upload_id
            selected_categories = set(json.loads(record.scan_categories_json))

        source_path = run_work / "baseline" / "source"
        _source_file, source = load_uploaded_python(
            dependencies.artifact_store,
            upload_id,
            source_path,
            dependencies.work_root,
        )
        baseline_syntax = validate_python_syntax(source)
        if not baseline_syntax.valid:
            fail_run(
                session_factory,
                run_id,
                "invalid_python_syntax",
                _syntax_failure_message(baseline_syntax),
            )
            return

        baseline_tests = unavailable_functional_tests()
        with session_factory() as session:
            if run_cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            if record is None:
                return
            set_stage(
                session,
                record,
                "baseline_scanning",
                completed_stage="baseline_testing",
                extra={
                    "baseline_syntax": baseline_syntax.model_dump(mode="json"),
                    "baseline_tests": baseline_tests.model_dump(mode="json"),
                },
            )

        bandit, semgrep = _run_static_scanners(source_path, dependencies)
        scan_status = combined_scan_status(bandit.status, semgrep.status)
        if bandit.status != "completed" or semgrep.status != "completed":
            fail_run(
                session_factory,
                run_id,
                "baseline_scan_incomplete",
                (
                    "Upload baseline scanners did not complete: "
                    f"bandit={bandit.status}, semgrep={semgrep.status}."
                ),
            )
            return
        findings = _filtered_findings(bandit, semgrep, selected_categories)

        with session_factory() as session:
            if run_cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            if record is None:
                return
            for attempt in record.attempts:
                attempt.status = JobStatus.QUEUED.value
            set_stage(
                session,
                record,
                "awaiting_strategy",
                completed_stage="baseline_scanning",
                extra={
                    "baseline_source": source,
                    "baseline_findings": [
                        item.model_dump(mode="json") for item in findings
                    ],
                    "baseline_tests": baseline_tests.model_dump(mode="json"),
                    "baseline_scan_status": scan_status,
                    "baseline_syntax": baseline_syntax.model_dump(mode="json"),
                    "current_strategy": None,
                },
            )
    except UploadSourceError as exc:
        fail_run(session_factory, run_id, "upload_source_failed", exc.reason)
    except Exception as exc:
        fail_run(session_factory, run_id, "baseline_failed", str(exc))
    finally:
        _cleanup_if_terminal(session_factory, dependencies, run_id)


def _load_upload_baseline(
    record: RunRecord,
) -> tuple[
    str,
    list[Finding],
    TestExecution,
    str,
    SyntaxValidation,
    set[str],
    list[tuple[str, str]],
]:
    progress = progress_payload(record)
    return (
        str(progress["baseline_source"]),
        [Finding.model_validate(item) for item in progress["baseline_findings"]],
        TestExecution.model_validate(progress["baseline_tests"]),
        str(progress["baseline_scan_status"]),
        SyntaxValidation.model_validate(progress["baseline_syntax"]),
        set(json.loads(record.scan_categories_json)),
        [(item.attempt_id, item.strategy_id) for item in record.attempts],
    )


def execute_upload_repairs(
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
            (
                baseline_source,
                baseline_findings,
                baseline_tests,
                baseline_scan_status,
                baseline_syntax,
                selected_categories,
                attempts,
            ) = _load_upload_baseline(record)

        results: list[StrategyResult] = []
        for attempt_id, strategy_value in attempts:
            with session_factory() as session:
                if run_cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                if record is None:
                    return
                set_stage(
                    session,
                    record,
                    "repairing",
                    extra={"current_strategy": strategy_value},
                )

            source_path = run_work / attempt_id / "source"
            shutil.copytree(run_work / "baseline" / "source", source_path)
            source_files = [item for item in source_path.iterdir() if item.is_file()]
            if len(source_files) != 1 or source_files[0].suffix.lower() != ".py":
                raise RuntimeError("single_python_file_required")
            source_file = source_files[0]
            strategy_id = StrategyId(strategy_value)
            try:
                repair = repair_source(
                    strategy_id,
                    baseline_source,
                    baseline_findings,
                    baseline_tests,
                    dependencies.llm_client,
                )
            except Exception as exc:
                usage = LlmUsage(
                    source="local_fallback",
                    provider=None,
                    model=None,
                    status="failed",
                    input_tokens=0,
                    output_tokens=0,
                    estimated_cost_usd=0,
                    latency_ms=0,
                    retries=0,
                )
                results.append(
                    _failed_repair_result(
                        attempt_id=attempt_id,
                        strategy_id=strategy_id,
                        baseline_findings=baseline_findings,
                        baseline_scan_status=baseline_scan_status,
                        baseline_syntax=baseline_syntax,
                        usage=usage,
                        summary="Repair attempt failed before producing a candidate.",
                        limitation=f"Repair failed with {type(exc).__name__}.",
                    )
                )
                if not _mark_attempt_failed(
                    run_id,
                    attempt_id,
                    "repair_error",
                    session_factory,
                ):
                    return
                continue
            if repair.value is None:
                usage = _llm_usage(repair)
                results.append(
                    _failed_repair_result(
                        attempt_id=attempt_id,
                        strategy_id=strategy_id,
                        baseline_findings=baseline_findings,
                        baseline_scan_status=baseline_scan_status,
                        baseline_syntax=baseline_syntax,
                        usage=usage,
                        summary=(
                            "Repair provider returned status "
                            f"{repair.status} without a candidate."
                        ),
                        limitation="No candidate repair was produced or rescanned.",
                    )
                )
                if not _mark_attempt_failed(
                    run_id,
                    attempt_id,
                    "repair_unavailable",
                    session_factory,
                ):
                    return
                continue
            repaired_code = repair.value.repaired_code
            if len(repaired_code) > MAX_REPAIRED_SOURCE_CHARS:
                raise RuntimeError("Repaired source exceeded the bounded size limit.")
            repaired_syntax = validate_python_syntax(repaired_code)
            if not repaired_syntax.valid:
                results.append(
                    _failed_repair_result(
                        attempt_id=attempt_id,
                        strategy_id=strategy_id,
                        baseline_findings=baseline_findings,
                        baseline_scan_status=baseline_scan_status,
                        baseline_syntax=baseline_syntax,
                        usage=_llm_usage(repair),
                        summary=repair.value.summary,
                        limitation=_syntax_failure_message(repaired_syntax),
                        repaired_code=repaired_code,
                        repaired_syntax=repaired_syntax,
                    )
                )
                if not _mark_attempt_failed(
                    run_id,
                    attempt_id,
                    "invalid_repaired_python_syntax",
                    session_factory,
                ):
                    return
                continue
            source_file.write_text(repaired_code, encoding="utf-8")

            repaired_tests = unavailable_functional_tests()
            with session_factory() as session:
                if run_cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                if record is None:
                    return
                set_stage(
                    session,
                    record,
                    "repaired_testing",
                    completed_stage="repairing",
                    extra={"repaired_tests": repaired_tests.model_dump(mode="json")},
                )
                set_stage(
                    session,
                    record,
                    "repaired_scanning",
                    completed_stage="repaired_testing",
                )

            bandit, semgrep = _run_static_scanners(source_path, dependencies)
            scan_status = combined_scan_status(bandit.status, semgrep.status)
            if bandit.status != "completed" or semgrep.status != "completed":
                fail_run(
                    session_factory,
                    run_id,
                    "repaired_scan_incomplete",
                    (
                        "Upload repair scanners did not complete: "
                        f"bandit={bandit.status}, semgrep={semgrep.status}."
                    ),
                )
                return
            repaired_findings = _filtered_findings(
                bandit,
                semgrep,
                selected_categories,
            )
            metrics = score_static_strategy(
                StaticEvidenceSnapshot(
                    findings_count=len(baseline_findings),
                    scan_status=baseline_scan_status,
                    syntax_valid=baseline_syntax.valid,
                ),
                StaticEvidenceSnapshot(
                    findings_count=len(repaired_findings),
                    scan_status=scan_status,
                    syntax_valid=repaired_syntax.valid,
                    cost_usd=repair.estimated_cost_usd,
                    latency_ms=repair.latency_ms,
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
                    repaired_code=repaired_code,
                    repair_summary=repair.value.summary,
                    limitations=repair.value.limitations,
                    repaired_findings=repaired_findings,
                    repaired_scan_status=scan_status,
                    repaired_syntax=repaired_syntax,
                    repaired_tests=repaired_tests,
                    llm_usage=usage,
                    review=(
                        "The candidate passed syntax validation and was rescanned. "
                        "Uploaded code was not executed; this is not a security guarantee."
                    ),
                    metrics=metrics,
                )
            )
            with session_factory() as session:
                if run_cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                if record is None:
                    return
                matching = next(
                    item for item in record.attempts if item.attempt_id == attempt_id
                )
                matching.status = JobStatus.COMPLETED.value
                set_stage(
                    session,
                    record,
                    "repaired_scanning",
                    completed_stage="repaired_scanning",
                )

        with session_factory() as session:
            if run_cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            if record is None:
                return
            set_stage(session, record, "reviewing")
            set_stage(session, record, "reporting", completed_stage="reviewing")
            report = build_report(
                run_id=run_id,
                mode=Mode.UPLOAD,
                evaluation_kind="upload_static",
                baseline_source=baseline_source,
                baseline_findings=baseline_findings,
                baseline_scan_status=baseline_scan_status,
                baseline_syntax=baseline_syntax,
                baseline_tests=baseline_tests,
                strategy_results=results,
                explanation=(
                    "SecureEval compared syntax validation and completed static "
                    "scanner evidence using deterministic upload-only metrics."
                ),
                explanation_source="local_fallback",
                limitations=[
                    "Uploaded code and tests were not executed.",
                    "Static analysis and syntax validation are not a security guarantee.",
                    "Upload results are exploratory and excluded from benchmark aggregates.",
                ],
                created_at=datetime.now(UTC),
            )
            save_report(session, report)
    except Exception as exc:
        fail_run(session_factory, run_id, "repair_pipeline_failed", str(exc))
    finally:
        _cleanup_if_terminal(session_factory, dependencies, run_id)


def _llm_usage(result: LlmResult[RepairProposal]) -> LlmUsage:
    return LlmUsage(
        source=result.source,
        provider=result.provider,
        model=result.model,
        status=result.status,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        estimated_cost_usd=result.estimated_cost_usd,
        latency_ms=result.latency_ms,
        retries=result.retries,
    )


def _failed_repair_result(
    *,
    attempt_id: str,
    strategy_id: StrategyId,
    baseline_findings: list[Finding],
    baseline_scan_status: str,
    baseline_syntax: SyntaxValidation,
    usage: LlmUsage,
    summary: str,
    limitation: str,
    repaired_code: str = "",
    repaired_syntax: SyntaxValidation | None = None,
) -> StrategyResult:
    metrics = score_static_strategy(
        StaticEvidenceSnapshot(
            findings_count=len(baseline_findings),
            scan_status=baseline_scan_status,
            syntax_valid=baseline_syntax.valid,
        ),
        StaticEvidenceSnapshot(
            findings_count=len(baseline_findings),
            scan_status="unavailable",
            syntax_valid=False,
            cost_usd=usage.estimated_cost_usd,
            latency_ms=usage.latency_ms,
        ),
    )
    return StrategyResult(
        attempt_id=attempt_id,
        strategy_id=strategy_id,
        status=JobStatus.FAILED,
        repaired_code=repaired_code,
        repair_summary=summary,
        limitations=[limitation],
        repaired_findings=[],
        repaired_scan_status="unavailable",
        repaired_syntax=repaired_syntax,
        repaired_tests=unavailable_functional_tests(),
        llm_usage=usage,
        review=(
            "The candidate failed syntax validation and was not rescanned. "
            "Uploaded code was not executed."
            if repaired_syntax is not None
            else "No repair candidate was produced. Uploaded code was not executed or "
            "rescanned for this failed attempt."
        ),
        metrics=metrics,
    )


def _mark_attempt_failed(
    run_id: str,
    attempt_id: str,
    failure_code: str,
    session_factory: sessionmaker[Session],
) -> bool:
    with session_factory() as session:
        if run_cancelled(session, run_id):
            return False
        record = session.get(RunRecord, run_id)
        if record is None:
            return False
        matching = next(item for item in record.attempts if item.attempt_id == attempt_id)
        matching.status = JobStatus.FAILED.value
        matching.failure_code = failure_code
        session.commit()
    return True
