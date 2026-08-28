import json
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from app.llm.client import LlmClient
from app.main import create_app
from app.schemas import TestExecution


PROMPT = "Create a Python function that safely looks up a user by name in SQLite."


def _create_custom_run(client: TestClient) -> str:
    response = client.post(
        "/api/v1/runs",
        json={
            "mode": "custom_prompt",
            "custom_prompt": PROMPT,
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    )
    assert response.status_code == 201
    return response.json()["run_id"]


def test_custom_prompt_fails_honestly_without_api_configuration(
    client: TestClient,
) -> None:
    run_id = _create_custom_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    run = client.get(f"/api/v1/runs/{run_id}").json()

    assert run["status"] == "failed"
    assert run["failure_code"] == "generation_unavailable"
    assert client.get(f"/api/v1/runs/{run_id}/report").status_code == 404


def test_custom_prompt_uses_real_provider_contract_and_persists_report(
    database_url: str,
    tmp_path: Path,
    monkeypatch,
) -> None:
    requests: list[dict[str, object]] = []

    def provider(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        requests.append(payload)
        contract = payload["response_format"]["json_schema"]["name"]
        if contract == "GeneratedProgram":
            content = {
                "code": (
                    "def lookup(connection, username):\n"
                    "    query = f\"SELECT id FROM users WHERE username = '{username}'\"\n"
                    "    return connection.execute(query).fetchone()\n"
                )
            }
        else:
            content = {
                "repaired_code": (
                    "def lookup(connection, username):\n"
                    "    query = \"SELECT id FROM users WHERE username = ?\"\n"
                    "    return connection.execute(query, (username,)).fetchone()\n"
                ),
                "summary": "Parameterized the SQL lookup.",
                "limitations": ["Smoke execution is not a trusted test suite."],
            }
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": json.dumps(content)}}],
                "usage": {"prompt_tokens": 23, "completion_tokens": 17},
            },
        )

    llm = LlmClient(
        base_url="https://provider.test/v1",
        api_key="test-key",
        model="test-model",
        transport=httpx.MockTransport(provider),
    )
    from app import custom_runner

    monkeypatch.setattr(
        custom_runner,
        "run_docker_smoke",
        lambda *_args, **_kwargs: TestExecution(
            status="completed", passed=1, failed=0, skipped=0,
            duration_ms=4, output="", output_truncated=False,
        ),
    )
    artifact_root = tmp_path / "artifacts"
    with TestClient(
        create_app(
            database_url=database_url,
            artifact_root=artifact_root,
            llm_client=llm,
        )
    ) as client:
        run_id = _create_custom_run(client)
        assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
        assert client.get(f"/api/v1/runs/{run_id}/progress").json()["stage"] == "awaiting_strategy"
        assert client.post(
            f"/api/v1/runs/{run_id}/strategies",
            json={"strategies": ["vulnerability_specific_v1"]},
        ).status_code == 200
        report = client.get(f"/api/v1/runs/{run_id}/report").json()

    assert [item["response_format"]["json_schema"]["name"] for item in requests] == [
        "GeneratedProgram", "RepairProposal"
    ]
    assert report["mode"] == "custom_prompt"
    assert report["evaluation_kind"] == "custom_prompt_smoke"
    assert report["baseline_source"].startswith("def lookup")
    assert report["baseline_tests"]["status"] == "completed"
    assert report["generation_usage"]["source"] == "llm"
    assert report["generation_usage"]["input_tokens"] == 23
    result = report["strategy_results"][0]
    assert result["metrics"]["score_basis"] == "static_smoke"
    assert result["repaired_tests"]["status"] == "completed"
    assert result["llm_usage"]["source"] == "llm"
    assert report["best_overall"] == "vulnerability_specific_v1"

    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as restarted:
        assert restarted.get(f"/api/v1/runs/{run_id}/report").json() == report
