import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize(
    "payload",
    [
        {
            "mode": "benchmark",
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
        {
            "mode": "custom_prompt",
            "task_id": "task_demo_001",
            "custom_prompt": "This field combination is forbidden by the mode contract.",
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
        {
            "mode": "upload",
            "scan_categories": ["secrets"],
            "strategies": ["vulnerability_specific_v1"],
        },
        {
            "mode": "benchmark",
            "task_id": "task_demo_001",
            "scan_categories": ["injection", "injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ],
)
def test_mode_and_collection_validation_returns_safe_envelope(
    client: TestClient, payload: dict[str, object]
) -> None:
    response = client.post("/api/v1/runs", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["message"] == "Request validation failed."
    assert response.json()["error"]["request_id"].startswith("req_")
    assert "input" not in response.json()


def test_client_cannot_control_metrics_state_or_official_eligibility(
    client: TestClient, benchmark_run_payload: dict[str, object]
) -> None:
    payload = {
        **benchmark_run_payload,
        "official_eligible": True,
        "status": "completed",
        "metrics": {"security_effectiveness": 1.0},
    }
    response = client.post("/api/v1/runs", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_missing_run_returns_safe_not_found_without_identifier_echo(client: TestClient) -> None:
    response = client.get("/api/v1/runs/run_00000000000000000000000000000000")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "run_not_found"
    assert response.json()["error"]["message"] == "Run not found."
    assert "run_00000000000000000000000000000000" not in response.text
