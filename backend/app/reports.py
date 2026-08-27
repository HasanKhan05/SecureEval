import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.errors import APIError
from app.models import (
    FindingRecord,
    LlmCallRecord,
    RunRecord,
    RunReportRecord,
    TestExecutionRecord,
)
from app.enums import JobStatus, Mode
from app.scoring import METRIC_POLICY_SUMMARY, RankingInput, rank_strategies
from app.schemas import Finding, RunReport, StrategyResult, TestExecution


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def _finding_record(
    run_id: str,
    attempt_id: str | None,
    stage: str,
    finding: Finding,
) -> FindingRecord:
    return FindingRecord(
        finding_id=finding.finding_id,
        run_id=run_id,
        attempt_id=attempt_id,
        stage=stage,
        scanner=finding.scanner,
        rule_id=finding.rule_id,
        category=finding.category.value,
        severity=finding.severity,
        confidence=finding.confidence,
        filename=finding.filename,
        line_start=finding.line_start,
        line_end=finding.line_end,
        message=finding.message,
    )


def _test_record(
    run_id: str,
    attempt_id: str | None,
    stage: str,
    execution: TestExecution,
) -> TestExecutionRecord:
    return TestExecutionRecord(
        test_execution_id=_new_id("test"),
        run_id=run_id,
        attempt_id=attempt_id,
        stage=stage,
        status=execution.status,
        passed=execution.passed,
        failed=execution.failed,
        skipped=execution.skipped,
        duration_ms=execution.duration_ms,
        output=execution.output,
        output_truncated=execution.output_truncated,
    )


def save_report(session: Session, report: RunReport) -> None:
    run = session.get(RunRecord, report.run_id)
    if run is None:
        raise APIError(404, "run_not_found", "Run not found.")

    for record_type in (FindingRecord, TestExecutionRecord, LlmCallRecord):
        session.execute(delete(record_type).where(record_type.run_id == report.run_id))

    session.add_all(
        _finding_record(report.run_id, None, "baseline", finding)
        for finding in report.baseline_findings
    )
    session.add(_test_record(report.run_id, None, "baseline", report.baseline_tests))

    for result in report.strategy_results:
        session.add_all(
            _finding_record(report.run_id, result.attempt_id, "repaired", finding)
            for finding in result.repaired_findings
        )
        session.add(
            _test_record(
                report.run_id,
                result.attempt_id,
                "repaired",
                result.repaired_tests,
            )
        )
        usage = result.llm_usage
        session.add(
            LlmCallRecord(
                llm_call_id=_new_id("llm"),
                run_id=report.run_id,
                attempt_id=result.attempt_id,
                purpose="repair",
                source=usage.source,
                provider=usage.provider,
                model=usage.model,
                status=usage.status,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                estimated_cost_microusd=round(usage.estimated_cost_usd * 1_000_000),
                latency_ms=usage.latency_ms,
                retries=usage.retries,
            )
        )

    session.merge(
        RunReportRecord(
            run_id=report.run_id,
            schema_version=report.schema_version,
            report_json=report.model_dump_json(),
            best_overall=report.best_overall.value if report.best_overall else None,
            best_efficiency=(
                report.best_efficiency.value if report.best_efficiency else None
            ),
            created_at=report.created_at.isoformat().replace("+00:00", "Z"),
        )
    )
    run.status = report.status.value
    run.stage = "completed"
    run.progress_json = json.dumps(
        {
            "completed_stages": [
                "baseline_testing",
                "baseline_scanning",
                "repairing",
                "repaired_testing",
                "repaired_scanning",
                "reviewing",
                "reporting",
            ],
            "current_strategy": None,
        },
        separators=(",", ":"),
    )
    session.commit()


def load_report(session: Session, run_id: str) -> RunReport:
    record = session.get(RunReportRecord, run_id)
    if record is None:
        raise APIError(404, "report_not_found", "Run report not found.")
    return RunReport.model_validate_json(record.report_json)


def build_report(
    *,
    run_id: str,
    mode: Mode,
    baseline_source: str,
    baseline_findings: list[Finding],
    baseline_scan_status: str = "completed",
    baseline_tests: TestExecution,
    strategy_results: list[StrategyResult],
    explanation: str,
    explanation_source: str,
    limitations: list[str],
    created_at: datetime,
) -> RunReport:
    eligible = [
        item
        for item in strategy_results
        if item.status == JobStatus.COMPLETED
        and item.repaired_tests.status == "completed"
        and item.repaired_scan_status == "completed"
    ]
    ranking = rank_strategies(
        [
            RankingInput(
                attempt_id=item.attempt_id,
                strategy_id=item.strategy_id,
                metrics=item.metrics,
                cost_usd=item.llm_usage.estimated_cost_usd,
                token_count=(
                    item.llm_usage.input_tokens + item.llm_usage.output_tokens
                ),
                latency_ms=item.llm_usage.latency_ms,
            )
            for item in eligible
        ]
    )
    return RunReport(
        run_id=run_id,
        status=JobStatus.COMPLETED,
        mode=mode,
        baseline_source=baseline_source,
        baseline_findings=baseline_findings,
        baseline_scan_status=baseline_scan_status,
        baseline_tests=baseline_tests,
        strategy_results=strategy_results,
        best_overall=ranking.best_overall,
        best_efficiency=ranking.best_efficiency,
        explanation=explanation,
        explanation_source=explanation_source,
        limitations=[*limitations, METRIC_POLICY_SUMMARY],
        created_at=created_at,
    )
