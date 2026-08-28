from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from app.enums import StrategyId
from app.schemas import StrategyMetrics, ToolStatus


METRIC_POLICY_SUMMARY = (
    "portfolio-metrics-v1: overall=70% security + 30% functionality; "
    "efficiency=(security/100)*(functionality/100)/max(cost_usd,0.01), "
    "capped at 100."
)


@dataclass(frozen=True)
class EvidenceSnapshot:
    findings_count: int
    tests_status: ToolStatus
    passed: int
    failed: int
    cost_usd: float = 0
    latency_ms: int = 0
    scan_status: ToolStatus = "completed"


@dataclass(frozen=True)
class StaticEvidenceSnapshot:
    findings_count: int
    scan_status: ToolStatus
    syntax_valid: bool
    cost_usd: float = 0
    latency_ms: int = 0


@dataclass(frozen=True)
class RankingInput:
    attempt_id: str
    strategy_id: StrategyId
    metrics: StrategyMetrics
    cost_usd: float
    token_count: int
    latency_ms: int


@dataclass(frozen=True)
class Ranking:
    best_overall: StrategyId | None
    best_efficiency: StrategyId | None


def _rounded(value: float) -> float:
    return round(max(0, min(100, value)), 4)


def score_strategy(
    baseline: EvidenceSnapshot,
    repaired: EvidenceSnapshot,
) -> StrategyMetrics:
    tools_completed = (
        baseline.tests_status == "completed"
        and repaired.tests_status == "completed"
        and baseline.scan_status == "completed"
        and repaired.scan_status == "completed"
    )
    if not tools_completed:
        return StrategyMetrics(
            findings_before=baseline.findings_count,
            findings_after=repaired.findings_count,
            fixed_count=0,
            security_score=0,
            functionality_score=0,
            overall_score=0,
            efficiency_score=0,
        )

    fixed_count = max(0, baseline.findings_count - repaired.findings_count)
    if baseline.findings_count == 0:
        security = 100 if repaired.findings_count == 0 else 0
    else:
        security = 100 * fixed_count / baseline.findings_count

    baseline_passed = max(1, baseline.passed)
    pass_preservation = min(1, repaired.passed / baseline_passed)
    repaired_total = repaired.passed + repaired.failed
    failure_rate = repaired.failed / max(1, repaired_total)
    functionality = 100 * pass_preservation * (1 - failure_rate)
    overall = 0.7 * security + 0.3 * functionality
    efficiency = (
        (security / 100)
        * (functionality / 100)
        / max(repaired.cost_usd, 0.01)
    )

    return StrategyMetrics(
        findings_before=baseline.findings_count,
        findings_after=repaired.findings_count,
        fixed_count=fixed_count,
        security_score=_rounded(security),
        functionality_score=_rounded(functionality),
        overall_score=_rounded(overall),
        efficiency_score=_rounded(efficiency),
    )


def score_static_strategy(
    baseline: StaticEvidenceSnapshot,
    repaired: StaticEvidenceSnapshot,
) -> StrategyMetrics:
    if (
        baseline.scan_status != "completed"
        or repaired.scan_status != "completed"
        or not baseline.syntax_valid
        or not repaired.syntax_valid
    ):
        return StrategyMetrics(
            score_basis="static_only",
            findings_before=baseline.findings_count,
            findings_after=repaired.findings_count,
            fixed_count=0,
            security_score=0,
            functionality_score=None,
            overall_score=0,
            efficiency_score=0,
        )

    fixed = max(0, baseline.findings_count - repaired.findings_count)
    security = (
        100
        if baseline.findings_count == repaired.findings_count == 0
        else 100 * fixed / max(1, baseline.findings_count)
    )
    efficiency = (security / 100) / max(repaired.cost_usd, 0.01)
    return StrategyMetrics(
        score_basis="static_only",
        findings_before=baseline.findings_count,
        findings_after=repaired.findings_count,
        fixed_count=fixed,
        security_score=_rounded(security),
        functionality_score=None,
        overall_score=_rounded(security),
        efficiency_score=_rounded(efficiency),
    )


def rank_strategies(candidates: list[RankingInput]) -> Ranking:
    if not candidates:
        return Ranking(best_overall=None, best_efficiency=None)

    frame = pd.DataFrame(
        [
            {
                "attempt_id": item.attempt_id,
                "strategy_id": item.strategy_id.value,
                "security": item.metrics.security_score,
                "functionality": item.metrics.functionality_score,
                "overall": item.metrics.overall_score,
                "efficiency": item.metrics.efficiency_score,
                "introduced": max(
                    0,
                    item.metrics.findings_after - item.metrics.findings_before,
                ),
                "cost": item.cost_usd,
                "tokens": item.token_count,
                "latency": item.latency_ms,
            }
            for item in candidates
        ]
    )
    overall = frame.sort_values(
        [
            "security",
            "functionality",
            "introduced",
            "cost",
            "latency",
            "attempt_id",
        ],
        ascending=[False, False, True, True, True, True],
        kind="stable",
    ).iloc[0]
    efficiency = frame.sort_values(
        ["efficiency", "tokens", "latency", "attempt_id"],
        ascending=[False, True, True, True],
        kind="stable",
    ).iloc[0]
    return Ranking(
        best_overall=StrategyId(overall["strategy_id"]),
        best_efficiency=StrategyId(efficiency["strategy_id"]),
    )
