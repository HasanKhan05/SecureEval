import io
import zipfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from sqlalchemy import select

from app.main import create_app
from app.models import AuditEventRecord, UploadArtifactRecord


def _zip_bytes(path: str, content: bytes) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr(path, content)
    return buffer.getvalue()


def test_upload_endpoint_returns_redacted_exploratory_receipt(client) -> None:
    response = client.post(
        "/api/v1/uploads",
        data={"purpose": "uploaded_code"},
        files={"source": ("source.py", b"value = 1\n", "text/x-python")},
    )

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {
        "schema_version",
        "upload_id",
        "purpose",
        "file_count",
        "total_bytes",
        "content_hash",
        "retention_class",
        "created_at",
        "expires_at",
    }
    assert body["schema_version"] == "1.0"
    assert body["purpose"] == "uploaded_code"
    assert body["file_count"] == 1
    assert body["total_bytes"] == 10
    assert body["retention_class"] == "exploratory_24h"
    assert "path" not in response.text.lower()
    assert "value = 1" not in response.text

    with client.app.state.session_factory() as session:
        artifact = session.get(UploadArtifactRecord, body["upload_id"])
        assert artifact is not None
        assert artifact.storage_key == body["upload_id"]
        audit = session.scalar(
            select(AuditEventRecord).where(
                AuditEventRecord.event_type == "upload_accepted"
            )
        )
        assert audit is not None
        assert audit.subject_id == body["upload_id"]
        assert audit.reason_code is None


def test_upload_endpoint_rejects_hostile_archive_without_leaking_name(client) -> None:
    sentinel = "PRIVATE_UPLOAD_SENTINEL_7F3A9C"
    response = client.post(
        "/api/v1/uploads",
        data={"purpose": "uploaded_code"},
        files={
            "source": (
                "hostile.zip",
                _zip_bytes(
                    "../private-secret.py",
                    f"secret = {sentinel!r}\n".encode(),
                ),
                "application/zip",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "upload_rejected"
    assert response.json()["error"]["message"] == "Source upload was rejected."
    assert "private-secret" not in response.text
    assert sentinel not in response.text
    with client.app.state.session_factory() as session:
        audit = session.scalar(
            select(AuditEventRecord).where(
                AuditEventRecord.event_type == "upload_rejected"
            )
        )
        assert audit is not None
        assert audit.subject_id is None
        assert audit.reason_code == "unsafe_path"
        persisted_values = " ".join(str(value) for value in vars(audit).values())
        assert sentinel not in persisted_values


def test_upload_endpoint_rejects_unknown_purpose(client) -> None:
    response = client.post(
        "/api/v1/uploads",
        data={"purpose": "official_fixture"},
        files={"source": ("source.py", b"value = 1\n", "text/x-python")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_rejected_upload_leaves_artifact_root_empty(client) -> None:
    response = client.post(
        "/api/v1/uploads",
        data={"purpose": "custom_prompt_context"},
        files={"source": ("binary.py", b"\x00binary", "application/octet-stream")},
    )

    assert response.status_code == 400
    root: Path = client.app.state.artifact_store.root
    assert list(root.iterdir()) == []


def test_startup_deletes_expired_unbound_artifact_from_persisted_metadata(
    database_url: str,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "persistent_artifacts"
    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as first_client:
        response = first_client.post(
            "/api/v1/uploads",
            data={"purpose": "uploaded_code"},
            files={"source": ("source.py", b"value = 1\n", "text/x-python")},
        )
        upload_id = response.json()["upload_id"]
        artifact_path = first_client.app.state.artifact_store.root / upload_id
        with first_client.app.state.session_factory() as session:
            artifact = session.get(UploadArtifactRecord, upload_id)
            artifact.expires_at = (
                datetime.now(UTC) - timedelta(seconds=1)
            ).isoformat().replace("+00:00", "Z")
            session.commit()
        assert artifact_path.is_dir()

    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as restarted_client:
        with restarted_client.app.state.session_factory() as session:
            artifact = session.get(UploadArtifactRecord, upload_id)
            assert artifact.state == "deleted"
            assert artifact.deleted_at is not None
        assert not artifact_path.exists()


def test_startup_keeps_expired_artifact_bound_to_active_run(
    database_url: str,
    tmp_path: Path,
) -> None:
    artifact_root = tmp_path / "active_artifacts"
    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as first_client:
        upload = first_client.post(
            "/api/v1/uploads",
            data={"purpose": "uploaded_code"},
            files={"source": ("source.py", b"value = 1\n", "text/x-python")},
        ).json()
        created = first_client.post(
            "/api/v1/runs",
            json={
                "mode": "upload",
                "upload_id": upload["upload_id"],
                "scan_categories": ["injection"],
                "strategies": ["vulnerability_specific_v1"],
            },
        )
        assert created.status_code == 201
        artifact_path = artifact_root / upload["upload_id"]
        with first_client.app.state.session_factory() as session:
            artifact = session.get(UploadArtifactRecord, upload["upload_id"])
            artifact.expires_at = (
                datetime.now(UTC) - timedelta(seconds=1)
            ).isoformat().replace("+00:00", "Z")
            session.commit()

    with TestClient(
        create_app(database_url=database_url, artifact_root=artifact_root)
    ) as restarted_client:
        with restarted_client.app.state.session_factory() as session:
            artifact = session.get(UploadArtifactRecord, upload["upload_id"])
            assert artifact.state == "available"
            assert artifact.deleted_at is None
        assert artifact_path.is_dir()
