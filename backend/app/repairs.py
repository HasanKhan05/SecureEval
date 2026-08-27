from __future__ import annotations

import json

from app.enums import StrategyId
from app.llm.client import LlmClient
from app.llm.contracts import LlmResult, RepairProposal
from app.schemas import Finding, TestExecution


STRATEGY_INSTRUCTIONS = {
    StrategyId.VULNERABILITY_SPECIFIC: (
        "Make the smallest change that repairs the normalized vulnerabilities."
    ),
    StrategyId.SCANNER_FEEDBACK: (
        "Repair the scanner findings while avoiding unrelated refactoring."
    ),
    StrategyId.TEST_FEEDBACK: (
        "Repair the vulnerabilities while preserving the observed test behavior."
    ),
}


def _fallback(source: str, provider_status: str) -> LlmResult[RepairProposal]:
    vulnerable_query = (
        'query = f"SELECT id, username, role FROM users WHERE username = '
        "'{username}'\""
    )
    parameterized_query = (
        'query = "SELECT id, username, role FROM users WHERE username = ?"'
    )
    vulnerable_execute = "connection.execute(query).fetchone()"
    parameterized_execute = "connection.execute(query, (username,)).fetchone()"
    if vulnerable_query not in source or vulnerable_execute not in source:
        return LlmResult(
            value=None,
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

    repaired = source.replace(vulnerable_query, parameterized_query).replace(
        vulnerable_execute, parameterized_execute
    )
    return LlmResult(
        value=RepairProposal(
            repaired_code=repaired,
            summary=(
                "Local deterministic fallback parameterized the fixture SQL query "
                f"after LLM status: {provider_status}."
            ),
            limitations=[
                "The local fallback recognizes only the demonstrated SQL interpolation pattern."
            ],
        ),
        source="local_fallback",
        provider=None,
        model=None,
        status="completed",
        input_tokens=0,
        output_tokens=0,
        estimated_cost_usd=0,
        latency_ms=0,
        retries=0,
    )


def repair_source(
    strategy_id: StrategyId,
    source: str,
    findings: list[Finding],
    test_result: TestExecution,
    llm_client: LlmClient,
) -> LlmResult[RepairProposal]:
    if len(source) > 200_000:
        return _fallback("", "source_too_large")

    if llm_client.available:
        messages = [
            {
                "role": "system",
                "content": (
                    "Return only the requested JSON repair contract. Do not add "
                    "markdown. Preserve functionality and do not claim verification."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "strategy": STRATEGY_INSTRUCTIONS[strategy_id],
                        "source": source,
                        "findings": [item.model_dump(mode="json") for item in findings],
                        "tests": test_result.model_dump(mode="json"),
                    },
                    separators=(",", ":"),
                ),
            },
        ]
        result = llm_client.complete(RepairProposal, messages)
        if result.status == "completed" and result.value is not None:
            return result
        return _fallback(source, result.status)

    return _fallback(source, "unavailable")
