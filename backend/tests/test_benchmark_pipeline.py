import json

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import RunRecord


def test_benchmark_run_completes_with_real_evidence(
    client: TestClient, database_url: str
) -> None:
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "benchmark",
            "task_id": "T-01",
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ).json()
    run_id = created["run_id"]

    started = client.post(f"/api/v1/runs/{run_id}/start")
    progress = client.get(f"/api/v1/runs/{run_id}/progress")

    assert started.status_code == 200
    assert progress.status_code == 200
    assert progress.json()["stage"] == "awaiting_strategy"

    configured = client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    )
    report_response = client.get(f"/api/v1/runs/{run_id}/report")

    assert configured.status_code == 200
    assert report_response.status_code == 200
    report = report_response.json()
    assert report["status"] == "completed"
    assert {item["scanner"] for item in report["baseline_findings"]} >= {
        "bandit",
        "semgrep",
    }
    assert report["baseline_tests"]["passed"] == 2
    assert report["strategy_results"][0]["repaired_tests"]["failed"] == 0
    assert report["strategy_results"][0]["repaired_findings"] == []
    assert report["best_overall"] == "scanner_feedback_v1"
    assert report["explanation_source"] in {"llm", "local_fallback"}
    assert report["strategy_results"][0]["llm_usage"]["source"] in {
        "llm",
        "local_fallback",
    }
    assert report["baseline_scan_status"] == "completed"
    assert report["strategy_results"][0]["repaired_scan_status"] == "completed"
    assert report["evaluation_kind"] == "benchmark_full"
    assert report["baseline_syntax"] is None
    assert report["strategy_results"][0]["metrics"]["score_basis"] == "full"

    with Session(create_engine(database_url)) as session:
        record = session.get(RunRecord, run_id)
        assert record is not None
        manifest = json.loads(record.manifest_json)
    assert manifest["strategy_ids"] == ["scanner_feedback_v1"]

    completed_progress = client.get(f"/api/v1/runs/{run_id}/progress").json()
    assert completed_progress["status"] == "completed"
    assert completed_progress["stage"] == "completed"


def test_selected_categories_filter_reported_and_scored_findings(
    client: TestClient,
) -> None:
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "benchmark",
            "task_id": "T-01",
            "scan_categories": ["secrets"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ).json()
    run_id = created["run_id"]

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    ).status_code == 200
    report = client.get(f"/api/v1/runs/{run_id}/report").json()

    assert report["baseline_findings"] == []
    assert report["strategy_results"][0]["metrics"]["findings_before"] == 0


def test_baseline_start_and_strategy_configuration_are_each_one_shot(
    client: TestClient,
) -> None:
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "benchmark",
            "task_id": "T-01",
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ).json()
    run_id = created["run_id"]

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 409
    first = client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["vulnerability_specific_v1"]},
    )
    second = client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["vulnerability_specific_v1"]},
    )

    assert first.status_code == 200
    assert second.status_code == 409