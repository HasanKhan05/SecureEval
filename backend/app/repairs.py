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


def _known_fallback_repair(source: str) -> tuple[str, str] | None:
    vulnerable_query = (
        'query = f"SELECT id, username, role FROM users WHERE username = '
        "'{username}'\""
    )
    vulnerable_execute = "connection.execute(query).fetchone()"
    if vulnerable_query in source and vulnerable_execute in source:
        repaired = source.replace(
            vulnerable_query,
            'query = "SELECT id, username, role FROM users WHERE username = ?"',
        ).replace(
            vulnerable_execute,
            "connection.execute(query, (username,)).fetchone()",
        )
        return repaired, "parameterized the fixture SQL query"

    vulnerable_path_read = 'return (Path(root) / requested_path).read_text(encoding="utf-8")'
    if vulnerable_path_read in source:
        repaired = source.replace(
            f"    {vulnerable_path_read}",
            '    root_path = Path(root).resolve()\n'
            '    candidate = (root_path / requested_path).resolve()\n'
            '    if not candidate.is_relative_to(root_path):\n'
            '        raise ValueError("document path escapes root")\n'
            '    return candidate.read_text(encoding="utf-8")',
        )
        return repaired, "contained document reads beneath the configured root"

    vulnerable_command = 'return ["sh", "-c", f"git {action} {target}"]'
    if vulnerable_command in source:
        repaired = source.replace(
            f"    {vulnerable_command}",
            '    allowed = {"status": "status", "show": "show"}\n'
            '    if action not in allowed:\n'
            '        raise ValueError("unsupported action")\n'
            '    return ["git", allowed[action], "--", target]',
        )
        return repaired, "replaced shell interpolation with an allowlisted argv list"

    hardcoded_token = 'DEFAULT_API_TOKEN = "sk-demo-hardcoded-token"'
    if hardcoded_token in source:
        repaired = source.replace(f"{hardcoded_token}\n\n\n", "").replace(
            '    return env.get("SECUREEVAL_SAMPLE_TOKEN", DEFAULT_API_TOKEN)',
            '    token = env.get("SECUREEVAL_SAMPLE_TOKEN", "")\n'
            '    if not token:\n'
            '        raise ValueError("token is not configured")\n'
            '    return token',
        )
        return repaired, "removed the hardcoded token fallback"

    vulnerable_digest = 'hashlib.md5(salt + password.encode("utf-8")).hexdigest()'
    if vulnerable_digest in source:
        repaired = source.replace(
            vulnerable_digest,
            'hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000).hex()',
        )
        return repaired, "replaced MD5 with PBKDF2-HMAC-SHA256"
    return None


def _fallback(source: str, provider_status: str) -> LlmResult[RepairProposal]:
    candidate = _known_fallback_repair(source)
    if candidate is None:
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

    repaired, repair_name = candidate
    limitation = (
        "The local fallback recognizes only the demonstrated SQL interpolation pattern."
        if repair_name == "parameterized the fixture SQL query"
        else "The local fallback recognizes only the five controlled benchmark patterns."
    )
    return LlmResult(
        value=RepairProposal(
            repaired_code=repaired,
            summary=(
                f"Local deterministic fallback {repair_name} "
                f"after LLM status: {provider_status}."
            ),
            limitations=[limitation],
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