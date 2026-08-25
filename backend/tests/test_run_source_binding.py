import json
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models import RunRecord, UploadArtifactRecord


def _upload(client, purpose: str) -> str:
    response = client.post(
        "/api/v1/uploads",
        data={"purpose": purpose},
        files={"source": ("source.py", b"value = 1\n", "text/x-python")},
    )
    assert response.status_code == 201
    return response.json()["upload_id"]


def _run_payload(mode: str, upload_id: str) -> dict[str, object]:
    payload: dict[str, object] = {
        "mode": mode,
        "upload_id": upload_id,
        "scan_categories": ["injection"],
        "strategies": ["vulnerability_specific_v1"],
    }
    if mode == "custom_prompt":
        payload["custom_prompt"] = "Repair this input without changing behavior."
    return payload


def test_custom_prompt_can_bind_optional_context_artifact(client) -> None:
    upload_id = _upload(client, "custom_prompt_context")

    response = client.post(
        "/api/v1/runs", json=_run_payload("custom_prompt", upload_id)
    )

    assert response.status_code == 201
    assert response.json()["official_eligible"] is False
    with client.app.state.session_factory() as session:
        artifact = session.get(UploadArtifactRecord, upload_id)
        assert artifact.bound_run_id == response.json()["run_id"]


def test_upload_mode_binds_uploaded_code_and_freezes_redacted_provenance(client) -> None:
    upload_id = _upload(client, "uploaded_code")

    response = client.post("/api/v1/runs", json=_run_payload("upload", upload_id))

    assert response.status_code == 201
    with client.app.state.session_factory() as session:
        record = session.get(RunRecord, response.json()["run_id"])
        manifest = json.loads(record.manifest_json)
        source = manifest["source_artifact"]
        assert source == {
            "content_hash": session.get(UploadArtifactRecord, upload_id).content_hash,
            "file_count": 1,
            "purpose": "uploaded_code",
            "retention_class": "exploratory_24h",
            "total_bytes": 10,
            "upload_id": upload_id,
        }
        assert "storage_key" not in record.manifest_json
        assert "source.py" not in record.manifest_json
        assert "value = 1" not in record.manifest_json


def test_run_rejects_artifact_with_wrong_purpose(client) -> None:
    upload_id = _upload(client, "custom_prompt_context")

    response = client.post("/api/v1/runs", json=_run_payload("upload", upload_id))

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "upload_purpose_mismatch"


def test_run_rejects_missing_expired_or_already_bound_artifact(client) -> None:
    missing = client.post(
        "/api/v1/runs",
        json=_run_payload("upload", "upload_" + "f" * 32),
    )
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "upload_not_found"

    expired_id = _upload(client, "uploaded_code")
    with client.app.state.session_factory() as session:
        artifact = session.get(UploadArtifactRecord, expired_id)
        artifact.expires_at = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
        session.commit()
    expired = client.post("/api/v1/runs", json=_run_payload("upload", expired_id))
    assert expired.status_code == 410
    assert expired.json()["error"]["code"] == "upload_expired"

    bound_id = _upload(client, "uploaded_code")
    first = client.post("/api/v1/runs", json=_run_payload("upload", bound_id))
    assert first.status_code == 201
    second = client.post("/api/v1/runs", json=_run_payload("upload", bound_id))
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "upload_already_bound"


def test_benchmark_mode_rejects_upload_reference_at_contract_boundary(client) -> None:
    upload_id = _upload(client, "uploaded_code")
    payload = {
        "mode": "benchmark",
        "task_id": "task_demo_001",
        "upload_id": upload_id,
        "scan_categories": ["injection"],
        "strategies": ["vulnerability_specific_v1"],
    }

    response = client.post("/api/v1/runs", json=payload)

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"

def test_concurrent_run_requests_bind_upload_exactly_once(client, monkeypatch) -> None:
    upload_id = _upload(client, "uploaded_code")
    barrier = threading.Barrier(2)
    original_get = Session.get

    def synchronized_get(session, entity, identifier, *args, **kwargs):
        result = original_get(session, entity, identifier, *args, **kwargs)
        if entity is UploadArtifactRecord and identifier == upload_id:
            barrier.wait(timeout=5)
        return result

    monkeypatch.setattr(Session, "get", synchronized_get)
    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(
            executor.map(
                lambda _: client.post(
                    "/api/v1/runs", json=_run_payload("upload", upload_id)
                ),
                range(2),
            )
        )

    assert sorted(response.status_code for response in responses) == [201, 409]
    rejected = next(response for response in responses if response.status_code == 409)
    assert rejected.json()["error"]["code"] == "upload_already_bound"
