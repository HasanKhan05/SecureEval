import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import Finding
from app.services import cancel_run
from app.tools.bandit import ScanResult


VULNERABLE_UPLOAD = (
    b"import sqlite3\n\n"
    b"def lookup(connection, username):\n"
    b'    query = f"SELECT id, username, role FROM users WHERE username = '
    b"'{username}'\"\n"
    b"    return connection.execute(query).fetchone()\n"
)


def _create_upload_run(
    client: TestClient,
    source: bytes = VULNERABLE_UPLOAD,
    *,
    categories: list[str] | None = None,
) -> str:
    upload = client.post(
        "/api/v1/uploads",
        files={"source": ("audit.py", source, "text/x-python")},
        data={"purpose": "uploaded_code"},
    ).json()
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "upload",
            "upload_id": upload["upload_id"],
            "scan_categories": categories or ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ).json()
    return created["run_id"]


def test_upload_run_completes_with_real_static_evidence(
    client: TestClient,
) -> None:
    run_id = _create_upload_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert (
        client.get(f"/api/v1/runs/{run_id}/progress").json()["stage"]
        == "awaiting_strategy"
    )
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    ).status_code == 200

    report = client.get(f"/api/v1/runs/{run_id}/report").json()

    assert report["mode"] == "upload"
    assert report["evaluation_kind"] == "upload_static"
    assert report["baseline_syntax"]["valid"] is True
    assert report["baseline_tests"]["status"] == "unavailable"
    assert {item["scanner"] for item in report["baseline_findings"]} >= {
        "bandit",
        "semgrep",
    }
    result = report["strategy_results"][0]
    assert result["repaired_syntax"]["valid"] is True
    assert result["repaired_tests"]["status"] == "unavailable"
    assert result["repaired_findings"] == []
    assert result["metrics"]["score_basis"] == "static_only"
    assert report["best_overall"] == "scanner_feedback_v1"


def test_upload_source_and_pytest_adapter_are_never_executed(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.tools import pytest_runner

    def reject_pytest(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("upload mode must not reference the pytest adapter")

    monkeypatch.setattr(pytest_runner, "run_pytest", reject_pytest)
    run_id = _create_upload_run(
        client,
        b"raise RuntimeError('uploaded source executed')\nVALUE = 1\n",
    )

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    progress = client.get(f"/api/v1/runs/{run_id}/progress").json()

    assert progress["status"] == "running"
    assert progress["stage"] == "awaiting_strategy"


def test_static_adapters_receive_only_trusted_materialized_source_directory(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner
    from app.models import RunRecord

    calls: list[tuple[str, Path]] = []
    run_id = _create_upload_run(client)
    session_factory = client.app.state.session_factory

    def completed_scan(scanner: str):
        def run(source: Path, _timeout: float) -> ScanResult:
            calls.append((scanner, source))
            assert source.is_dir()
            assert [item.name for item in source.iterdir()] == ["audit.py"]
            if source.parent.name != "baseline":
                with session_factory() as session:
                    record = session.get(RunRecord, run_id)
                    assert record is not None
                    stage = record.stage
                    progress = json.loads(record.progress_json)
                assert stage == "repaired_scanning"
                assert "repaired_testing" in progress["completed_stages"]
            return ScanResult(
                status="completed",
                findings=[],
                output="",
                output_truncated=False,
                duration_ms=1,
            )

        return run

    monkeypatch.setattr(upload_runner, "run_bandit", completed_scan("bandit"))
    monkeypatch.setattr(upload_runner, "run_semgrep", completed_scan("semgrep"))
    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200

    baseline_source = (
        client.app.state.runner_dependencies.work_root
        / run_id
        / "baseline"
        / "source"
    ).resolve()
    assert calls == [("bandit", baseline_source), ("semgrep", baseline_source)]
    configured = client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    )
    attempt_id = configured.json()["attempt_summaries"][0]["attempt_id"]
    repaired_source = (
        client.app.state.runner_dependencies.work_root
        / run_id
        / attempt_id
        / "source"
    ).resolve()

    assert calls == [
        ("bandit", baseline_source),
        ("semgrep", baseline_source),
        ("bandit", repaired_source),
        ("semgrep", repaired_source),
    ]
    assert all(
        path.is_relative_to(
            client.app.state.runner_dependencies.work_root.resolve()
        )
        for _, path in calls
    )


def test_invalid_upload_syntax_fails_before_scanners_and_cleans_workspace(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner

    def reject_scan(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("syntax-invalid uploads must not be scanned")

    monkeypatch.setattr(upload_runner, "run_bandit", reject_scan)
    monkeypatch.setattr(upload_runner, "run_semgrep", reject_scan)
    run_id = _create_upload_run(client, b"def broken(:\n    pass\n")

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    response = client.get(f"/api/v1/runs/{run_id}").json()

    assert response["status"] == "failed"
    assert response["failure_code"] == "invalid_python_syntax"
    assert "invalid syntax" in response["failure_message"].lower()
    assert not (client.app.state.runner_dependencies.work_root / run_id).exists()


@pytest.mark.parametrize("scanner_status", ["failed", "unavailable"])
def test_incomplete_baseline_scanner_evidence_fails_without_claiming_clean(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    scanner_status: str,
) -> None:
    from app import upload_runner

    calls: list[str] = []

    def scan(scanner: str, status: str):
        def run(_source: Path, _timeout: float) -> ScanResult:
            calls.append(scanner)
            return ScanResult(
                status=status,
                findings=[],
                output=f"{scanner} did not complete",
                output_truncated=False,
                duration_ms=1,
            )

        return run

    monkeypatch.setattr(upload_runner, "run_bandit", scan("bandit", scanner_status))
    monkeypatch.setattr(upload_runner, "run_semgrep", scan("semgrep", "completed"))
    run_id = _create_upload_run(client, b"VALUE = 1\n")

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    response = client.get(f"/api/v1/runs/{run_id}").json()

    assert calls == ["bandit", "semgrep"]
    assert response["status"] == "failed"
    assert response["failure_code"] == "baseline_scan_incomplete"
    assert client.get(f"/api/v1/runs/{run_id}/report").status_code == 404
    assert not (client.app.state.runner_dependencies.work_root / run_id).exists()


def test_upload_categories_filter_findings_and_static_score(
    client: TestClient,
) -> None:
    run_id = _create_upload_run(client, categories=["secrets"])

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["vulnerability_specific_v1"]},
    ).status_code == 200
    report = client.get(f"/api/v1/runs/{run_id}/report").json()

    assert report["baseline_findings"] == []
    assert report["strategy_results"][0]["repaired_findings"] == []
    assert report["strategy_results"][0]["metrics"] == {
        "score_basis": "static_only",
        "findings_before": 0,
        "findings_after": 0,
        "fixed_count": 0,
        "security_score": 100.0,
        "functionality_score": None,
        "overall_score": 100.0,
        "efficiency_score": 100.0,
    }


def test_upload_cancellation_during_analysis_cleans_workspace(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner

    session_factory = client.app.state.session_factory
    run_id = _create_upload_run(client, b"VALUE = 1\n")

    def cancelling_scan(_source: Path, _timeout: float) -> ScanResult:
        with session_factory() as session:
            cancel_run(session, run_id)
        return ScanResult(
            status="completed",
            findings=[],
            output="",
            output_truncated=False,
            duration_ms=1,
        )

    monkeypatch.setattr(upload_runner, "run_bandit", cancelling_scan)
    monkeypatch.setattr(
        upload_runner,
        "run_semgrep",
        lambda _source, _timeout: ScanResult(
            status="completed",
            findings=[],
            output="",
            output_truncated=False,
            duration_ms=1,
        ),
    )

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    response = client.get(f"/api/v1/runs/{run_id}").json()

    assert response["status"] == "cancelled"
    assert not (client.app.state.runner_dependencies.work_root / run_id).exists()


def test_completed_upload_report_survives_application_restart(
    database_url: str,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "persistent_artifacts"
    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as first_client:
        run_id = _create_upload_run(first_client)
        assert first_client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
        assert first_client.post(
            f"/api/v1/runs/{run_id}/strategies",
            json={"strategies": ["scanner_feedback_v1"]},
        ).status_code == 200
        expected = first_client.get(f"/api/v1/runs/{run_id}/report").json()
        from app.models import RunRecord, UploadArtifactRecord

        with first_client.app.state.session_factory() as session:
            run = session.get(RunRecord, run_id)
            upload_id = run.upload_id
            artifact = session.get(UploadArtifactRecord, upload_id)
            artifact.expires_at = (
                datetime.now(UTC) - timedelta(seconds=1)
            ).isoformat().replace("+00:00", "Z")
            session.commit()
        artifact_path = artifact_root / upload_id

    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as restarted_client:
        restored = restarted_client.get(f"/api/v1/runs/{run_id}/report")

    assert restored.status_code == 200
    assert restored.json() == expected
    assert not artifact_path.exists()


def test_custom_prompt_backend_requires_real_provider_configuration(
    client: TestClient,
) -> None:
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "custom_prompt",
            "custom_prompt": "Repair this illustrative source without executing it.",
            "scan_categories": ["input_validation"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ).json()
    run_id = created["run_id"]

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    response = client.get(f"/api/v1/runs/{run_id}").json()

    assert response["status"] == "failed"
    assert response["failure_code"] == "generation_unavailable"


def test_upload_report_persists_a_finding_that_survives_repair(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner

    persistent = Finding(
        finding_id="finding_" + "f" * 32,
        scanner="bandit",
        rule_id="B608",
        category="injection",
        severity="medium",
        confidence="medium",
        filename="audit.py",
        line_start=3,
        line_end=3,
        message="Possible SQL injection vector.",
    )

    def bandit(_source: Path, _timeout: float) -> ScanResult:
        return ScanResult(
            status="completed",
            findings=[persistent],
            output="",
            output_truncated=False,
            duration_ms=1,
        )

    def semgrep(_source: Path, _timeout: float) -> ScanResult:
        return ScanResult(
            status="completed",
            findings=[],
            output="",
            output_truncated=False,
            duration_ms=1,
        )

    monkeypatch.setattr(upload_runner, "run_bandit", bandit)
    monkeypatch.setattr(upload_runner, "run_semgrep", semgrep)
    run_id = _create_upload_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    ).status_code == 200
    response = client.get(f"/api/v1/runs/{run_id}/report")

    assert response.status_code == 200
    report = response.json()
    assert report["baseline_findings"][0]["finding_id"] == persistent.finding_id
    assert (
        report["strategy_results"][0]["repaired_findings"][0]["finding_id"]
        == persistent.finding_id
    )


@pytest.mark.parametrize("failure_kind", ["failed_result", "exception"])
def test_failed_upload_repair_does_not_block_independent_strategy(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    failure_kind: str,
) -> None:
    from app import upload_runner
    from app.enums import StrategyId
    from app.llm.contracts import LlmResult

    real_repair_source = upload_runner.repair_source

    def repair(strategy_id, source, findings, test_result, llm_client):
        if strategy_id == StrategyId.VULNERABILITY_SPECIFIC:
            if failure_kind == "exception":
                raise RuntimeError("unexpected repair failure")
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
        return real_repair_source(
            strategy_id,
            source,
            findings,
            test_result,
            llm_client,
        )

    monkeypatch.setattr(upload_runner, "repair_source", repair)
    run_id = _create_upload_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={
            "strategies": [
                "vulnerability_specific_v1",
                "scanner_feedback_v1",
            ]
        },
    ).status_code == 200
    report_response = client.get(f"/api/v1/runs/{run_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    failed, completed = report["strategy_results"]
    assert failed["strategy_id"] == "vulnerability_specific_v1"
    assert failed["status"] == "failed"
    assert failed["repaired_code"] == ""
    assert failed["repaired_syntax"] is None
    assert failed["repaired_scan_status"] == "unavailable"
    assert failed["repaired_tests"]["status"] == "unavailable"
    assert failed["repaired_findings"] == []
    assert failed["llm_usage"]["status"] == "failed"
    assert failed["metrics"]["score_basis"] == "static_only"
    assert failed["metrics"]["findings_after"] == failed["metrics"]["findings_before"]
    assert failed["metrics"]["fixed_count"] == 0
    assert failed["metrics"]["security_score"] == 0
    assert failed["metrics"]["overall_score"] == 0
    assert failed["metrics"]["functionality_score"] is None
    assert completed["strategy_id"] == "scanner_feedback_v1"
    assert completed["status"] == "completed"
    assert report["best_overall"] == "scanner_feedback_v1"
    attempts = {
        item["strategy_id"]: item
        for item in client.get(f"/api/v1/runs/{run_id}").json()["attempt_summaries"]
    }
    assert attempts["vulnerability_specific_v1"] == {
        "attempt_id": failed["attempt_id"],
        "strategy_id": "vulnerability_specific_v1",
        "status": "failed",
        "failure_code": (
            "repair_error" if failure_kind == "exception" else "repair_unavailable"
        ),
    }
    assert attempts["scanner_feedback_v1"]["status"] == "completed"


def test_all_failed_upload_repairs_complete_without_winner(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner
    from app.llm.contracts import LlmResult

    monkeypatch.setattr(
        upload_runner,
        "repair_source",
        lambda *_args, **_kwargs: LlmResult(
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
        ),
    )
    run_id = _create_upload_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["vulnerability_specific_v1"]},
    ).status_code == 200
    report_response = client.get(f"/api/v1/runs/{run_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["status"] == "completed"
    assert report["strategy_results"][0]["status"] == "failed"
    assert report["best_overall"] is None
    assert report["best_efficiency"] is None
    run = client.get(f"/api/v1/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["attempt_summaries"][0]["status"] == "failed"
    assert run["attempt_summaries"][0]["failure_code"] == "repair_unavailable"


def test_invalid_repaired_syntax_fails_only_that_run_all_attempt(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner
    from app.enums import StrategyId
    from app.llm.contracts import LlmResult, RepairProposal

    real_repair_source = upload_runner.repair_source

    def repair(strategy_id, source, findings, test_result, llm_client):
        if strategy_id == StrategyId.VULNERABILITY_SPECIFIC:
            return LlmResult(
                value=RepairProposal(
                    repaired_code="def invalid(:\n    pass\n",
                    summary="Candidate with invalid syntax.",
                ),
                source="local_fallback",
                provider=None,
                model=None,
                status="completed",
                input_tokens=0,
                output_tokens=0,
                estimated_cost_usd=0,
                latency_ms=1,
                retries=0,
            )
        return real_repair_source(
            strategy_id, source, findings, test_result, llm_client
        )

    monkeypatch.setattr(upload_runner, "repair_source", repair)
    run_id = _create_upload_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["run_all"]},
    ).status_code == 200
    report_response = client.get(f"/api/v1/runs/{run_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    invalid = report["strategy_results"][0]
    later = report["strategy_results"][1]
    assert invalid["strategy_id"] == "vulnerability_specific_v1"
    assert invalid["status"] == "failed"
    assert invalid["repaired_syntax"]["status"] == "failed"
    assert invalid["repaired_syntax"]["valid"] is False
    assert invalid["repaired_scan_status"] == "unavailable"
    assert invalid["repaired_findings"] == []
    assert invalid["metrics"]["findings_after"] == invalid["metrics"]["findings_before"]
    assert invalid["metrics"]["fixed_count"] == 0
    assert invalid["metrics"]["security_score"] == 0
    assert invalid["metrics"]["overall_score"] == 0
    assert later["strategy_id"] == "scanner_feedback_v1"
    assert later["status"] == "completed"
    run = client.get(f"/api/v1/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["attempt_summaries"][0]["failure_code"] == "invalid_repaired_python_syntax"
    assert run["attempt_summaries"][1]["status"] == "completed"


def test_all_invalid_syntax_repairs_complete_without_winner(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import upload_runner
    from app.llm.contracts import LlmResult, RepairProposal

    monkeypatch.setattr(
        upload_runner,
        "repair_source",
        lambda *_args, **_kwargs: LlmResult(
            value=RepairProposal(
                repaired_code="def invalid(:\n    pass\n",
                summary="Candidate with invalid syntax.",
            ),
            source="local_fallback",
            provider=None,
            model=None,
            status="completed",
            input_tokens=0,
            output_tokens=0,
            estimated_cost_usd=0,
            latency_ms=1,
            retries=0,
        ),
    )
    run_id = _create_upload_run(client)

    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["run_all"]},
    ).status_code == 200
    report = client.get(f"/api/v1/runs/{run_id}/report").json()

    assert report["status"] == "completed"
    assert len(report["strategy_results"]) == 3
    assert all(item["status"] == "failed" for item in report["strategy_results"])
    assert all(
        item["repaired_syntax"]["valid"] is False
        for item in report["strategy_results"]
    )
    assert report["best_overall"] is None
    assert report["best_efficiency"] is None
