from datetime import UTC, datetime

from app.enums import JobStatus, Mode, StrategyId
from app.reports import build_report
from app.schemas import (
    LlmUsage,
    StrategyMetrics,
    StrategyResult,
    TestExecution,
)


def _strategy(strategy_id: StrategyId, score: float) -> StrategyResult:
    return StrategyResult(
        attempt_id=f"attempt_{strategy_id.value}",
        strategy_id=strategy_id,
        status=JobStatus.COMPLETED,
        repaired_code="print('repaired')\n",
        repair_summary="Applied and verified a candidate repair.",
        limitations=[],
        repaired_findings=[],
        repaired_tests=TestExecution(
            status="completed",
            passed=2,
            failed=0,
            skipped=0,
            duration_ms=10,
            output="2 passed",
            output_truncated=False,
        ),
        llm_usage=LlmUsage(
            source="local_fallback",
            provider=None,
            model=None,
            status="completed",
            input_tokens=0,
            output_tokens=0,
            estimated_cost_usd=0,
            latency_ms=10,
            retries=0,
        ),
        review="Configured checks passed; this is not a security guarantee.",
        metrics=StrategyMetrics(
            findings_before=1,
            findings_after=0,
            fixed_count=1,
            security_score=score,
            functionality_score=100,
            overall_score=score,
            efficiency_score=score,
        ),
    )


def test_build_report_selects_winners_without_using_explanation_text() -> None:
    stronger = _strategy(StrategyId.SCANNER_FEEDBACK, 100)
    weaker = _strategy(StrategyId.TEST_FEEDBACK, 70)

    report = build_report(
        run_id="run_" + "a" * 32,
        mode=Mode.BENCHMARK,
        baseline_source="print('baseline')\n",
        baseline_findings=[],
        baseline_tests=stronger.repaired_tests,
        strategy_results=[weaker, stronger],
        explanation="Arbitrary narrative that must not affect rankings.",
        explanation_source="local_fallback",
        limitations=["Static analysis is not a security guarantee."],
        created_at=datetime(2026, 8, 27, tzinfo=UTC),
    )

    assert report.best_overall == StrategyId.SCANNER_FEEDBACK
    assert report.best_efficiency == StrategyId.SCANNER_FEEDBACK
    assert report.explanation_source == "local_fallback"
    assert any("portfolio-metrics-v1" in item for item in report.limitations)

def test_build_report_excludes_unavailable_scanner_evidence_from_winners() -> None:
    unavailable = _strategy(StrategyId.SCANNER_FEEDBACK, 100)
    unavailable.repaired_scan_status = "unavailable"

    report = build_report(
        run_id="run_" + "b" * 32,
        mode=Mode.BENCHMARK,
        baseline_source="print('baseline')\n",
        baseline_findings=[],
        baseline_tests=unavailable.repaired_tests,
        strategy_results=[unavailable],
        explanation="No ranking may be inferred from unavailable evidence.",
        explanation_source="local_fallback",
        limitations=["Scanner evidence was unavailable."],
        created_at=datetime(2026, 8, 27, tzinfo=UTC),
    )

    assert report.best_overall is None
    assert report.best_efficiency is None