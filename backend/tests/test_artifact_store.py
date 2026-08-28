import os
import re
import stat
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from app.uploads.policy import UploadPurpose
from app.uploads.store import ArtifactStore, StoredArtifact
from app.uploads.validation import validate_source


def _validated_source():
    return validate_source("source.py", b"value = 1\n", policy=_policy())


def _policy():
    from app.uploads.policy import UploadPolicy

    return UploadPolicy()


def test_store_creates_opaque_contained_read_only_artifact(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    now = datetime(2026, 8, 25, 12, 0, tzinfo=UTC)
    store = ArtifactStore(root)

    artifact = store.store(
        _validated_source(), UploadPurpose.UPLOADED_CODE, now=now
    )

    assert re.fullmatch(r"upload_[0-9a-f]{32}", artifact.upload_id)
    assert artifact.storage_key == artifact.upload_id
    assert artifact.created_at == now
    assert artifact.expires_at == now + timedelta(hours=24)
    artifact_root = store.source_path(artifact.upload_id).parent
    assert artifact_root.resolve().is_relative_to(root.resolve())
    source_file = artifact_root / "source" / "source.py"
    assert source_file.read_bytes() == b"value = 1\n"
    assert source_file.stat().st_mode & stat.S_IWRITE == 0
    assert (artifact_root / "manifest.json").is_file()
    assert not any(path.suffix == ".zip" for path in artifact_root.rglob("*"))


def test_store_rolls_back_temporary_directory_on_write_failure(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "artifacts"
    store = ArtifactStore(root)
    original_write_bytes = Path.write_bytes

    def fail_manifest(path: Path, data: bytes) -> int:
        if path.name == "manifest.json":
            raise OSError("simulated disk failure")
        return original_write_bytes(path, data)

    monkeypatch.setattr(Path, "write_bytes", fail_manifest)

    with pytest.raises(OSError, match="simulated disk failure"):
        store.store(_validated_source(), UploadPurpose.UPLOADED_CODE)

    assert root.is_dir()
    assert list(root.iterdir()) == []


def test_delete_is_scoped_and_idempotent(tmp_path: Path) -> None:
    root = tmp_path / "artifacts"
    outside = tmp_path / "outside.txt"
    outside.write_text("keep", encoding="utf-8")
    store = ArtifactStore(root)
    artifact = store.store(_validated_source(), UploadPurpose.UPLOADED_CODE)

    assert store.delete(artifact.upload_id) is True
    assert store.delete(artifact.upload_id) is False
    with pytest.raises(ValueError, match="invalid upload identifier"):
        store.delete("../../outside.txt")
    assert outside.read_text(encoding="utf-8") == "keep"


def test_delete_expired_removes_only_elapsed_artifacts(tmp_path: Path) -> None:
    now = datetime(2026, 8, 25, 12, 0, tzinfo=UTC)
    identifiers = iter(["upload_" + "a" * 32, "upload_" + "b" * 32])
    store = ArtifactStore(tmp_path / "artifacts", id_factory=lambda: next(identifiers))
    expired = store.store(
        _validated_source(), UploadPurpose.UPLOADED_CODE, now=now - timedelta(days=2)
    )
    current = store.store(
        _validated_source(), UploadPurpose.CUSTOM_PROMPT_CONTEXT, now=now
    )

    deleted = store.delete_expired([expired, current], now=now)

    assert deleted == (expired.upload_id,)
    assert not (store.root / expired.storage_key).exists()
    assert (store.root / current.storage_key).is_dir()


def test_stored_artifact_does_not_expose_source_or_absolute_path() -> None:
    assert set(StoredArtifact.__dataclass_fields__) == {
        "upload_id",
        "storage_key",
        "purpose",
        "content_hash",
        "file_count",
        "total_bytes",
        "created_at",
        "expires_at",
    }


def test_store_retries_transient_windows_directory_rename(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.uploads import store as store_module

    root = tmp_path / "artifacts"
    store = ArtifactStore(root)
    original_replace = store_module.os.replace
    calls = 0

    def transient_replace(source: Path, destination: Path) -> None:
        nonlocal calls
        calls += 1
        if calls == 1:
            error = PermissionError("transient Windows directory lock")
            error.winerror = 5
            raise error
        original_replace(source, destination)

    monkeypatch.setattr(store_module.os, "replace", transient_replace)
    monkeypatch.setattr(store_module, "sleep", lambda _seconds: None, raising=False)

    artifact = store.store(_validated_source(), UploadPurpose.UPLOADED_CODE)

    assert calls == 2
    assert store.source_path(artifact.upload_id).is_dir()