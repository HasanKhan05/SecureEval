import pytest
from fastapi.testclient import TestClient


CASES = [
    ("T-01", "injection", "find_user"),
    ("T-02", "input_validation", "read_document"),
    ("T-03", "injection", "build_command"),
    ("T-04", "secrets", "get_api_token"),
    ("T-05", "authentication_authorization", "hash_password"),
]


@pytest.mark.parametrize(("task_id", "category", "source_marker"), CASES)
def test_each_controlled_benchmark_runs_its_own_tests_scanners_and_repair(
    client: TestClient,
    task_id: str,
    category: str,
    source_marker: str,
) -> None:
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "benchmark",
            "task_id": task_id,
            "scan_categories": [category],
            "strategies": ["scanner_feedback_v1"],
        },
    )
    assert created.status_code == 201
    run_id = created.json()["run_id"]

    started = client.post(f"/api/v1/runs/{run_id}/start")
    assert started.status_code == 200
    assert client.get(f"/api/v1/runs/{run_id}/progress").json()["stage"] == "awaiting_strategy"

    configured = client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    )
    assert configured.status_code == 200
    report_response = client.get(f"/api/v1/runs/{run_id}/report")
    assert report_response.status_code == 200
    report = report_response.json()

    assert source_marker in report["baseline_source"]
    assert report["baseline_tests"]["status"] == "completed"
    assert report["baseline_tests"]["failed"] == 0
    assert report["baseline_scan_status"] == "completed"
    assert report["baseline_findings"]
    result = report["strategy_results"][0]
    assert result["status"] == "completed"
    assert result["repaired_tests"]["failed"] == 0
    assert result["repaired_scan_status"] == "completed"
    assert result["repaired_findings"] == []
    assert result["llm_usage"]["source"] == "local_fallback"
