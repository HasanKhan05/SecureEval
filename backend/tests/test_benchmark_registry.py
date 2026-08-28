import importlib
import importlib.util

from fastapi.testclient import TestClient


def test_registry_exposes_exactly_five_controlled_tasks() -> None:
    assert importlib.util.find_spec("app.benchmarks") is not None
    module = importlib.import_module("app.benchmarks")

    assert module.list_benchmark_ids() == ("T-01", "T-02", "T-03", "T-04", "T-05")


def test_unknown_benchmark_is_rejected_before_persistence(client: TestClient) -> None:
    response = client.post(
        "/api/v1/runs",
        json={
            "mode": "benchmark",
            "task_id": "T-99",
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_benchmark"
