import json

import httpx

from app.llm.client import LlmClient
from app.llm.contracts import RepairProposal


def test_invalid_provider_json_is_retried_then_fails() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "not-json"}}]},
        )

    client = LlmClient(
        base_url="https://llm.example/v1",
        api_key="test-key",
        model="test-model",
        transport=httpx.MockTransport(handler),
    )

    result = client.complete(RepairProposal, messages=[])

    assert calls == 2
    assert result.status == "invalid_response"
    assert result.retries == 1
    assert result.value is None


def test_valid_provider_response_tracks_usage_cost_and_schema() -> None:
    content = {
        "repaired_code": "query = 'SELECT 1 WHERE ?'\n",
        "summary": "Used a parameterized query.",
        "limitations": [],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["response_format"]["type"] == "json_schema"
        assert request.headers["authorization"] == "Bearer test-key"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": json.dumps(content)}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 50},
            },
        )

    client = LlmClient(
        base_url="https://llm.example/v1/",
        api_key="test-key",
        model="test-model",
        input_price_per_million=2,
        output_price_per_million=4,
        transport=httpx.MockTransport(handler),
    )

    result = client.complete(RepairProposal, messages=[])

    assert result.status == "completed"
    assert result.source == "llm"
    assert result.value is not None
    assert result.value.summary == "Used a parameterized query."
    assert result.input_tokens == 100
    assert result.output_tokens == 50
    assert result.estimated_cost_usd == 0.0004
