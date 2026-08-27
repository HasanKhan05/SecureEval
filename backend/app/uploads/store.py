from __future__ import annotations

import os
import re
import shutil
import stat
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

from app.uploads.policy import UploadPurpose
from app.uploads.validation import ValidatedSource

UPLOAD_ID_PATTERN = re.compile(r"^upload_[0-9a-f]{32}$")


@dataclass(frozen=True)
class StoredArtifact:
    upload_id: str
    storage_key: str
    purpose: UploadPurpose
    content_hash: str
    file_count: int
    total_bytes: int
    created_at: datetime
    expires_at: datetime


def _new_upload_id() -> str:
    return f"upload_{uuid4().hex}"


def _remove_readonly(function, path: str, _excinfo) -> None:
    os.chmod(path, stat.S_IWRITE)
    function(path)


def _remove_tree(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path, onexc=_remove_readonly)


class ArtifactStore:
    def __init__(
        self,
        root: Path,
        *,
        id_factory: Callable[[], str] = _new_upload_id,
        retention: timedelta = timedelta(hours=24),
    ) -> None:
        self.root = root.resolve()
        self.id_factory = id_factory
        self.retention = retention
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    def _artifact_root(self, upload_id: str) -> Path:
        if not UPLOAD_ID_PATTERN.fullmatch(upload_id):
            raise ValueError("invalid upload identifier")
        path = (self.root / upload_id).resolve()
        if path.parent != self.root:
            raise ValueError("invalid upload identifier")
        return path

    def source_path(self, upload_id: str) -> Path:
        return self._artifact_root(upload_id) / "source"

    def copy_single_python_source(self, upload_id: str, destination: Path) -> Path:
        artifact_root = self._artifact_root(upload_id).resolve()
        source_root = self.source_path(upload_id).resolve()
        if not source_root.is_relative_to(self.root) or not source_root.is_relative_to(
            artifact_root
        ):
            raise ValueError("artifact_path_escape")
        files = [item for item in source_root.rglob("*") if item.is_file()]
        if len(files) != 1 or files[0].suffix.lower() != ".py":
            raise ValueError("single_python_file_required")
        source_file = files[0].resolve()
        if not source_file.is_relative_to(source_root) or not source_file.is_relative_to(
            self.root
        ):
            raise ValueError("artifact_path_escape")
        destination.mkdir(parents=True, exist_ok=False)
        output = destination / source_file.name
        shutil.copyfile(source_file, output)
        return output

    def store(
        self,
        source: ValidatedSource,
        purpose: UploadPurpose,
        *,
        now: datetime | None = None,
    ) -> StoredArtifact:
        created_at = now or datetime.now(UTC)
        upload_id = self.id_factory()
        destination = self._artifact_root(upload_id)
        if destination.exists():
            raise FileExistsError("artifact identifier collision")
        temporary = self.root / f".tmp_{uuid4().hex}"
        source_root = temporary / "source"
        temporary.mkdir(mode=0o700)
        try:
            source_root.mkdir(mode=0o700)
            for item in source.files:
                output = source_root.joinpath(*item.path.split("/"))
                if not output.resolve().is_relative_to(source_root.resolve()):
                    raise ValueError("validated source path escaped artifact root")
                output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                output.write_bytes(item.content)
                output.chmod(0o444)
            manifest_path = temporary / "manifest.json"
            manifest_path.write_bytes(source.manifest_json.encode("utf-8"))
            manifest_path.chmod(0o444)
            os.replace(temporary, destination)
        except BaseException:
            _remove_tree(temporary)
            raise
        return StoredArtifact(
            upload_id=upload_id,
            storage_key=upload_id,
            purpose=purpose,
            content_hash=source.content_hash,
            file_count=len(source.files),
            total_bytes=source.total_bytes,
            created_at=created_at,
            expires_at=created_at + self.retention,
        )

    def delete(self, upload_id: str) -> bool:
        artifact_root = self._artifact_root(upload_id)
        if not artifact_root.exists():
            return False
        _remove_tree(artifact_root)
        return True

    def delete_expired(
        self, artifacts: Iterable[StoredArtifact], *, now: datetime | None = None
    ) -> tuple[str, ...]:
        current_time = now or datetime.now(UTC)
        deleted: list[str] = []
        for artifact in artifacts:
            if artifact.expires_at <= current_time and self.delete(artifact.upload_id):
                deleted.append(artifact.upload_id)
        return tuple(deleted)