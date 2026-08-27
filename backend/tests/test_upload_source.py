from pathlib import Path

import pytest

from app.upload_source import UploadSourceError, load_uploaded_python
from app.uploads.policy import UploadPolicy, UploadPurpose
from app.uploads.store import ArtifactStore
from app.uploads.validation import ValidatedFile, ValidatedSource, validate_source


@pytest.fixture
def artifact_store(tmp_path: Path) -> ArtifactStore:
    return ArtifactStore(tmp_path / "artifacts")


def test_load_uploaded_python_copies_one_file_without_importing(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    source = validate_source(
        "audit.py",
        b"raise RuntimeError('must never execute')\n",
        UploadPolicy(),
    )
    artifact = artifact_store.store(source, UploadPurpose.UPLOADED_CODE)

    output, text = load_uploaded_python(
        artifact_store, artifact.upload_id, tmp_path / "work" / "source"
    )

    assert output.name == "audit.py"
    assert output.read_bytes() == b"raise RuntimeError('must never execute')\n"
    assert "must never execute" in text


def test_load_uploaded_python_rejects_multi_file_archive(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    source = ValidatedSource(
        files=(
            ValidatedFile("one.py", b"x = 1\n"),
            ValidatedFile("two.py", b"x = 2\n"),
        ),
        total_bytes=12,
        manifest_json="{}",
        content_hash="sha256:" + "0" * 64,
    )
    artifact = artifact_store.store(source, UploadPurpose.UPLOADED_CODE)

    with pytest.raises(UploadSourceError, match="single_python_file_required"):
        load_uploaded_python(
            artifact_store, artifact.upload_id, tmp_path / "work" / "source"
        )


def _store_source(
    artifact_store: ArtifactStore,
    filename: str,
    content: bytes,
) -> str:
    source = ValidatedSource(
        files=(ValidatedFile(filename, content),),
        total_bytes=len(content),
        manifest_json="{}",
        content_hash="sha256:" + "0" * 64,
    )
    return artifact_store.store(source, UploadPurpose.UPLOADED_CODE).upload_id


def test_load_uploaded_python_rejects_missing_artifact(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    with pytest.raises(UploadSourceError, match="single_python_file_required"):
        load_uploaded_python(
            artifact_store,
            "upload_" + "0" * 32,
            tmp_path / "work" / "source",
        )


def test_load_uploaded_python_rejects_non_python_source(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    upload_id = _store_source(artifact_store, "notes.txt", b"plain text\n")

    with pytest.raises(UploadSourceError, match="single_python_file_required"):
        load_uploaded_python(artifact_store, upload_id, tmp_path / "work" / "source")


def test_load_uploaded_python_rejects_invalid_utf8(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    upload_id = _store_source(artifact_store, "invalid.py", b"x = \xff\n")

    with pytest.raises(UploadSourceError, match="unsupported_encoding"):
        load_uploaded_python(artifact_store, upload_id, tmp_path / "work" / "source")


def test_load_uploaded_python_rejects_path_escape(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "safe.py").write_bytes(b"x = 2\n")

    class EscapedSourceStore(ArtifactStore):
        def source_path(self, upload_id: str) -> Path:
            return outside

    escaped_store = EscapedSourceStore(artifact_store.root)

    with pytest.raises(UploadSourceError, match="artifact_path_escape"):
        load_uploaded_python(
            escaped_store,
            "upload_" + "0" * 32,
            tmp_path / "work" / "source",
        )