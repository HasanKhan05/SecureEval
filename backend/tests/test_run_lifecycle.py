from fastapi.testclient import TestClient

from app.main import create_app


def test_create_read_start_cancel_lifecycle_is_persistent(
    client: TestClient,
    database_url: str,
    benchmark_run_payload: dict[str, object],
) -> None:
    created_response = client.post("/api/v1/runs", json=benchmark_run_payload)

    assert created_response.status_code == 201
    created = created_response.json()
    assert created["schema_version"] == "1.0"
    assert created["run_id"].startswith("run_")
    assert created["mode"] == "benchmark"
    assert created["mode_label"] == "Benchmark"
    assert created["official_eligible"] is False
    assert created["status"] == "queued"
    assert created["manifest_hash"].startswith("sha256:")
    assert created["attempt_summaries"][0]["status"] == "queued"

    run_id = created["run_id"]
    assert client.get(f"/api/v1/runs/{run_id}").json() == created

    started_response = client.post(f"/api/v1/runs/{run_id}/start")
    assert started_response.status_code == 200
    assert started_response.json()["status"] == "running"
    assert started_response.json()["attempt_summaries"][0]["status"] == "running"

    cancelled_response = client.post(f"/api/v1/runs/{run_id}/cancel")
    assert cancelled_response.status_code == 200
    assert cancelled_response.json()["status"] == "cancelled"
    assert cancelled_response.json()["attempt_summaries"][0]["status"] == "cancelled"

    with TestClient(create_app(database_url=database_url)) as restarted_client:
        persisted = restarted_client.get(f"/api/v1/runs/{run_id}")
    assert persisted.status_code == 200
    assert persisted.json()["status"] == "cancelled"


def test_run_all_expands_to_fixed_server_owned_strategy_ids(client: TestClient) -> None:
    response = client.post(
        "/api/v1/runs",
        json={
            "mode": "custom_prompt",
            "custom_prompt": "Repair the demonstrated input validation defect safely.",
            "scan_categories": ["input_validation"],
            "strategies": ["run_all"],
        },
    )

    assert response.status_code == 201
    assert response.json()["mode_label"] == "Exploratory — Custom Prompt"
    assert [item["strategy_id"] for item in response.json()["attempt_summaries"]] == [
        "vulnerability_specific_v1",
        "scanner_feedback_v1",
        "test_feedback_v1",
    ]


def test_cancel_is_idempotent_but_cancelled_run_cannot_restart(
    client: TestClient, benchmark_run_payload: dict[str, object]
) -> None:
    run_id = client.post("/api/v1/runs", json=benchmark_run_payload).json()["run_id"]

    first = client.post(f"/api/v1/runs/{run_id}/cancel")
    second = client.post(f"/api/v1/runs/{run_id}/cancel")
    restart = client.post(f"/api/v1/runs/{run_id}/start")

    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert restart.status_code == 409
    assert restart.json()["error"]["code"] == "invalid_state_transition"
