from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.enums import JobStatus, Mode, StrategyId
from app.generated_code import GeneratedCodeRejected, generate_program, validate_generated_python
from app.llm.contracts import LlmResult
from app.models import RunRecord
from app.repairs import repair_source
from app.reports import build_report, save_report
from app.runner_support import (
    RunnerDependencies, cleanup_run, combined_scan_status, fail_run,
    progress_payload, run_cancelled, set_stage,
)
from app.schemas import Finding, LlmUsage, StrategyMetrics, StrategyResult, SyntaxValidation, TestExecution
from app.scoring import StaticEvidenceSnapshot, score_static_strategy
from app.static_evidence import unavailable_functional_tests, validate_python_syntax
from app.tools.bandit import run_bandit
from app.tools.docker_smoke import run_docker_smoke
from app.tools.semgrep import run_semgrep


def _usage(result: LlmResult) -> LlmUsage:
    return LlmUsage(
        source=result.source, provider=result.provider, model=result.model,
        status=result.status, input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        estimated_cost_usd=result.estimated_cost_usd,
        latency_ms=result.latency_ms, retries=result.retries,
    )


def _scan(source_path: Path, selected: set[str], dependencies: RunnerDependencies):
    trusted = source_path.resolve(strict=True)
    if not trusted.is_dir() or not trusted.is_relative_to(dependencies.work_root.resolve()):
        raise RuntimeError("untrusted_source_directory")
    bandit = run_bandit(trusted, dependencies.tool_timeout_seconds)
    semgrep = run_semgrep(trusted, dependencies.tool_timeout_seconds)
    status = combined_scan_status(bandit.status, semgrep.status)
    findings = [
        item for item in [*bandit.findings, *semgrep.findings]
        if item.category.value in selected
    ]
    return bandit, semgrep, status, findings


def _smoke_metrics(
    baseline_findings: list[Finding], baseline_scan_status: str,
    baseline_syntax: SyntaxValidation, repaired_findings: list[Finding],
    repaired_scan_status: str, repaired_syntax: SyntaxValidation,
    usage: LlmUsage,
) -> StrategyMetrics:
    metrics = score_static_strategy(
        StaticEvidenceSnapshot(
            len(baseline_findings), baseline_scan_status, baseline_syntax.valid,
        ),
        StaticEvidenceSnapshot(
            len(repaired_findings), repaired_scan_status, repaired_syntax.valid,
            usage.estimated_cost_usd, usage.latency_ms,
        ),
    )
    return metrics.model_copy(update={"score_basis": "static_smoke"})


def execute_custom_baseline(
    run_id: str,
    session_factory: sessionmaker[Session],
    dependencies: RunnerDependencies,
) -> None:
    run_work = (dependencies.work_root / run_id).resolve()
    try:
        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            if record is None or record.status != JobStatus.RUNNING.value:
                return
            prompt = record.custom_prompt or ""
            selected = set(json.loads(record.scan_categories_json))

        generated = generate_program(prompt, dependencies.llm_client)
        if generated.value is None:
            fail_run(
                session_factory, run_id, f"generation_{generated.status}",
                f"Code generation did not complete (status: {generated.status}).",
            )
            return
        try:
            syntax = validate_generated_python(generated.value.code)
        except GeneratedCodeRejected:
            fail_run(
                session_factory, run_id, "generation_invalid_response",
                "The provider response was not an acceptable Python module.",
            )
            return

        source_path = run_work / "baseline" / "source"
        source_path.mkdir(parents=True, exist_ok=False)
        source_file = (source_path / "program.py").resolve()
        source_file.write_text(generated.value.code, encoding="utf-8")
        smoke = run_docker_smoke(
            source_file, run_work, dependencies.tool_timeout_seconds,
        )
        with session_factory() as session:
            if run_cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            set_stage(
                session, record, "baseline_scanning",
                completed_stage="baseline_testing",
                extra={"baseline_tests": smoke.model_dump(mode="json")},
            )
        bandit, semgrep, scan_status, findings = _scan(source_path, selected, dependencies)
        if bandit.status != "completed" or semgrep.status != "completed":
            fail_run(
                session_factory, run_id, "baseline_scan_incomplete",
                f"Custom baseline scanners did not complete: bandit={bandit.status}, semgrep={semgrep.status}.",
            )
            return
        generation_usage = _usage(generated)
        with session_factory() as session:
            if run_cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            for attempt in record.attempts:
                attempt.status = JobStatus.QUEUED.value
            set_stage(
                session, record, "awaiting_strategy",
                completed_stage="baseline_scanning",
                extra={
                    "baseline_source": generated.value.code,
                    "baseline_findings": [item.model_dump(mode="json") for item in findings],
                    "baseline_tests": smoke.model_dump(mode="json"),
                    "baseline_scan_status": scan_status,
                    "baseline_syntax": syntax.model_dump(mode="json"),
                    "generation_usage": generation_usage.model_dump(mode="json"),
                    "current_strategy": None,
                },
            )
    except Exception as exc:
        fail_run(session_factory, run_id, "baseline_failed", str(exc))
    finally:
        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            terminal = record is None or record.status in {
                JobStatus.FAILED.value, JobStatus.CANCELLED.value,
            }
        if terminal:
            cleanup_run(dependencies, run_id)


def _failed_result(
    attempt_id: str, strategy_id: StrategyId, baseline_findings: list[Finding],
    baseline_scan_status: str, baseline_syntax: SyntaxValidation,
    usage: LlmUsage, summary: str,
) -> StrategyResult:
    invalid = SyntaxValidation(status="failed", valid=False, message="No valid candidate was produced.")
    return StrategyResult(
        attempt_id=attempt_id, strategy_id=strategy_id, status=JobStatus.FAILED,
        repaired_code="", repair_summary=summary,
        limitations=["No candidate was executed or rescanned."],
        repaired_findings=[], repaired_scan_status="unavailable",
        repaired_syntax=None, repaired_tests=unavailable_functional_tests(),
        llm_usage=usage,
        review="The real provider did not produce a valid repair candidate.",
        metrics=_smoke_metrics(
            baseline_findings, baseline_scan_status, baseline_syntax,
            baseline_findings, "unavailable", invalid, usage,
        ),
    )


def execute_custom_repairs(
    run_id: str,
    session_factory: sessionmaker[Session],
    dependencies: RunnerDependencies,
) -> None:
    run_work = (dependencies.work_root / run_id).resolve()
    try:
        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            if record is None or record.status != JobStatus.RUNNING.value:
                return
            progress = progress_payload(record)
            baseline_source = str(progress["baseline_source"])
            baseline_findings = [Finding.model_validate(item) for item in progress["baseline_findings"]]
            baseline_tests = TestExecution.model_validate(progress["baseline_tests"])
            baseline_scan_status = str(progress["baseline_scan_status"])
            baseline_syntax = SyntaxValidation.model_validate(progress["baseline_syntax"])
            generation_usage = LlmUsage.model_validate(progress["generation_usage"])
            selected = set(json.loads(record.scan_categories_json))
            attempts = [(item.attempt_id, item.strategy_id) for item in record.attempts]

        results: list[StrategyResult] = []
        for attempt_id, strategy_value in attempts:
            strategy_id = StrategyId(strategy_value)
            with session_factory() as session:
                if run_cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                set_stage(session, record, "repairing", extra={"current_strategy": strategy_value})
            repair = repair_source(
                strategy_id, baseline_source, baseline_findings, baseline_tests,
                dependencies.llm_client, allow_fallback=False,
            )
            usage = _usage(repair)
            if repair.value is None:
                results.append(_failed_result(
                    attempt_id, strategy_id, baseline_findings,
                    baseline_scan_status, baseline_syntax, usage,
                    f"Repair provider returned status {repair.status} without a candidate.",
                ))
                with session_factory() as session:
                    record = session.get(RunRecord, run_id)
                    attempt = next(item for item in record.attempts if item.attempt_id == attempt_id)
                    attempt.status = JobStatus.FAILED.value
                    attempt.failure_code = "repair_unavailable"
                    session.commit()
                continue
            repaired_code = repair.value.repaired_code
            repaired_syntax = validate_python_syntax(repaired_code)
            if not repaired_syntax.valid:
                results.append(_failed_result(
                    attempt_id, strategy_id, baseline_findings,
                    baseline_scan_status, baseline_syntax, usage,
                    "The repair provider returned invalid Python syntax.",
                ))
                with session_factory() as session:
                    record = session.get(RunRecord, run_id)
                    attempt = next(item for item in record.attempts if item.attempt_id == attempt_id)
                    attempt.status = JobStatus.FAILED.value
                    attempt.failure_code = "invalid_repaired_python_syntax"
                    session.commit()
                continue
            source_path = run_work / attempt_id / "source"
            source_path.mkdir(parents=True, exist_ok=False)
            source_file = (source_path / "program.py").resolve()
            source_file.write_text(repaired_code, encoding="utf-8")
            smoke = run_docker_smoke(source_file, run_work, dependencies.tool_timeout_seconds)
            with session_factory() as session:
                if run_cancelled(session, run_id):
                    return
                record = session.get(RunRecord, run_id)
                set_stage(session, record, "repaired_testing", completed_stage="repairing")
                set_stage(session, record, "repaired_scanning", completed_stage="repaired_testing")
            bandit, semgrep, scan_status, findings = _scan(source_path, selected, dependencies)
            if bandit.status != "completed" or semgrep.status != "completed":
                fail_run(session_factory, run_id, "repaired_scan_incomplete", "Custom repair scanners did not complete.")
                return
            metrics = _smoke_metrics(
                baseline_findings, baseline_scan_status, baseline_syntax,
                findings, scan_status, repaired_syntax, usage,
            )
            results.append(StrategyResult(
                attempt_id=attempt_id, strategy_id=strategy_id,
                status=JobStatus.COMPLETED, repaired_code=repaired_code,
                repair_summary=repair.value.summary,
                limitations=repair.value.limitations,
                repaired_findings=findings, repaired_scan_status=scan_status,
                repaired_syntax=repaired_syntax, repaired_tests=smoke,
                llm_usage=usage,
                review=(
                    "The candidate passed syntax validation, isolated smoke execution, "
                    "and static rescanning. Smoke execution is not a trusted test suite."
                ),
                metrics=metrics,
            ))
            with session_factory() as session:
                record = session.get(RunRecord, run_id)
                attempt = next(item for item in record.attempts if item.attempt_id == attempt_id)
                attempt.status = JobStatus.COMPLETED.value
                set_stage(session, record, "repaired_scanning", completed_stage="repaired_scanning")

        with session_factory() as session:
            if run_cancelled(session, run_id):
                return
            record = session.get(RunRecord, run_id)
            set_stage(session, record, "reviewing")
            set_stage(session, record, "reporting", completed_stage="reviewing")
            report = build_report(
                run_id=run_id, mode=Mode.CUSTOM_PROMPT,
                evaluation_kind="custom_prompt_smoke",
                baseline_source=baseline_source,
                baseline_findings=baseline_findings,
                baseline_scan_status=baseline_scan_status,
                baseline_syntax=baseline_syntax,
                baseline_tests=baseline_tests,
                generation_usage=generation_usage,
                strategy_results=results,
                explanation=(
                    "SecureEval generated code through the configured AI provider, then "
                    "compared deterministic scanner evidence and isolated smoke outcomes."
                ),
                explanation_source="local_fallback",
                limitations=[
                    "Generated-code smoke execution is not a trusted functional test suite.",
                    "Static analysis and smoke execution are not a security guarantee.",
                    "Custom Prompt results are exploratory and excluded from benchmark aggregates.",
                ],
                created_at=datetime.now(UTC),
            )
            save_report(session, report)
    except Exception as exc:
        fail_run(session_factory, run_id, "repair_pipeline_failed", str(exc))
    finally:
        with session_factory() as session:
            record = session.get(RunRecord, run_id)
            terminal = record is None or record.status in {
                JobStatus.COMPLETED.value, JobStatus.FAILED.value, JobStatus.CANCELLED.value,
            }
        if terminal:
            cleanup_run(dependencies, run_id)
