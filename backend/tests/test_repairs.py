from pathlib import Path

from app.enums import StrategyId
from app.llm.client import LlmClient
from app.repairs import repair_source
from app.schemas import TestExecution
from app.static_evidence import unavailable_functional_tests


FIXTURE_SOURCE = (
    Path(__file__).parents[1]
    / "app"
    / "fixtures"
    / "benchmark_t01"
    / "source"
    / "app.py"
)


def test_missing_key_returns_labeled_deterministic_repair() -> None:
    source = FIXTURE_SOURCE.read_text(encoding="utf-8")
    client = LlmClient(
        base_url="https://api.openai.com/v1",
        api_key="",
        model="",
    )

    result = repair_source(
        StrategyId.VULNERABILITY_SPECIFIC,
        source,
        findings=[],
        test_result=TestExecution(
            status="completed",
            passed=2,
            failed=0,
            skipped=0,
            duration_ms=1,
            output="2 passed",
            output_truncated=False,
        ),
        llm_client=client,
    )

    assert result.status == "completed"
    assert result.source == "local_fallback"
    assert result.value is not None
    assert "username = ?" in result.value.repaired_code
    assert "execute(query, (username,))" in result.value.repaired_code
    assert "local deterministic fallback" in result.value.summary.lower()


def test_fallback_does_not_claim_to_repair_unknown_source() -> None:
    client = LlmClient(base_url="https://example.test/v1", api_key="", model="")

    result = repair_source(
        StrategyId.SCANNER_FEEDBACK,
        "print('safe')\n",
        findings=[],
        test_result=TestExecution(
            status="completed",
            passed=1,
            failed=0,
            skipped=0,
            duration_ms=1,
            output="1 passed",
            output_truncated=False,
        ),
        llm_client=client,
    )

    assert result.status == "failed"
    assert result.source == "local_fallback"
    assert result.value is None


def test_fallback_repairs_filename_independent_upload_without_tests() -> None:
    source = (
        "def uploaded_lookup(connection, username):\n"
        '    query = f"SELECT id, username, role FROM users WHERE username = '
        "'{username}'\"\n"
        "    return connection.execute(query).fetchone()\n"
    )
    client = LlmClient(base_url="https://example.test/v1", api_key="", model="")

    result = repair_source(
        StrategyId.SCANNER_FEEDBACK,
        source,
        findings=[],
        test_result=unavailable_functional_tests(),
        llm_client=client,
    )

    assert result.status == "completed"
    assert result.value is not None
    assert "username = ?" in result.value.repaired_code
    assert "execute(query, (username,))" in result.value.repaired_code
    assert result.value.limitations == [
        "The local fallback recognizes only the demonstrated SQL interpolation pattern."
    ]
