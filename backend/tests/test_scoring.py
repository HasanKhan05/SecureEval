from app.enums import StrategyId
from app.scoring import (
    EvidenceSnapshot,
    RankingInput,
    rank_strategies,
    score_strategy,
)


def test_zero_findings_and_preserved_tests_win_over_regression() -> None:
    baseline = EvidenceSnapshot(
        findings_count=2,
        tests_status="completed",
        passed=12,
        failed=0,
    )
    secure_metrics = score_strategy(
        baseline,
        EvidenceSnapshot(
            findings_count=0,
            tests_status="completed",
            passed=12,
            failed=0,
            cost_usd=0.02,
            latency_ms=3_000,
        ),
    )
    regressed_metrics = score_strategy(
        baseline,
        EvidenceSnapshot(
            findings_count=0,
            tests_status="completed",
            passed=9,
            failed=3,
            cost_usd=0.01,
            latency_ms=2_000,
        ),
    )

    ranking = rank_strategies(
        [
            RankingInput(
                attempt_id="attempt_b",
                strategy_id=StrategyId.TEST_FEEDBACK,
                metrics=regressed_metrics,
                cost_usd=0.01,
                token_count=100,
                latency_ms=2_000,
            ),
            RankingInput(
                attempt_id="attempt_a",
                strategy_id=StrategyId.SCANNER_FEEDBACK,
                metrics=secure_metrics,
                cost_usd=0.02,
                token_count=200,
                latency_ms=3_000,
            ),
        ]
    )

    assert ranking.best_overall == StrategyId.SCANNER_FEEDBACK
    assert ranking.best_efficiency in {
        StrategyId.SCANNER_FEEDBACK,
        StrategyId.TEST_FEEDBACK,
    }


def test_scores_depend_only_on_recorded_numeric_evidence() -> None:
    baseline = EvidenceSnapshot(1, "completed", 2, 0)
    repaired = EvidenceSnapshot(0, "completed", 2, 0, 0, 100)

    assert score_strategy(baseline, repaired) == score_strategy(baseline, repaired)


def test_unavailable_tools_never_receive_passing_scores() -> None:
    baseline = EvidenceSnapshot(1, "completed", 2, 0)
    unavailable = EvidenceSnapshot(0, "unavailable", 0, 0)

    metrics = score_strategy(baseline, unavailable)

    assert metrics.security_score == 0
    assert metrics.functionality_score == 0
    assert metrics.overall_score == 0


def test_efficiency_uses_the_versioned_cost_floor_formula() -> None:
    baseline = EvidenceSnapshot(1, "completed", 2, 0)
    free = score_strategy(
        baseline,
        EvidenceSnapshot(0, "completed", 2, 0, cost_usd=0),
    )
    paid = score_strategy(
        baseline,
        EvidenceSnapshot(0, "completed", 2, 0, cost_usd=0.02),
    )

    assert free.efficiency_score == 100
    assert paid.efficiency_score == 50


def test_best_overall_prioritizes_security_before_blended_score() -> None:
    baseline = EvidenceSnapshot(10, "completed", 10, 0)
    higher_security = score_strategy(
        baseline,
        EvidenceSnapshot(1, "completed", 1, 0),
    )
    higher_blended = score_strategy(
        baseline,
        EvidenceSnapshot(2, "completed", 10, 0),
    )

    ranking = rank_strategies(
        [
            RankingInput(
                "attempt_a",
                StrategyId.SCANNER_FEEDBACK,
                higher_security,
                0,
                0,
                10,
            ),
            RankingInput(
                "attempt_b",
                StrategyId.TEST_FEEDBACK,
                higher_blended,
                0,
                0,
                10,
            ),
        ]
    )

    assert higher_security.overall_score < higher_blended.overall_score
    assert ranking.best_overall == StrategyId.SCANNER_FEEDBACK
