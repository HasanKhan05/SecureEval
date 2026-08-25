import io
import zipfile
from pathlib import Path

from sqlalchemy import select

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
    response = client.post(
        "/api/v1/uploads",
        data={"purpose": "uploaded_code"},
        files={
            "source": (
                "hostile.zip",
                _zip_bytes("../private-secret.py", b"secret = 'never echo'\n"),
                "application/zip",
            )
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "upload_rejected"
    assert response.json()["error"]["message"] == "Source upload was rejected."
    assert "private-secret" not in response.text
    assert "never echo" not in response.text
    with client.app.state.session_factory() as session:
        audit = session.scalar(
            select(AuditEventRecord).where(
                AuditEventRecord.event_type == "upload_rejected"
            )
        )
        assert audit is not None
        assert audit.subject_id is None
        assert audit.reason_code == "unsafe_path"


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
