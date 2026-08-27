from __future__ import annotations

from pathlib import Path

from app.uploads.store import ArtifactStore


class UploadSourceError(ValueError):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def load_uploaded_python(
    store: ArtifactStore,
    upload_id: str,
    destination: Path,
    trusted_root: Path,
) -> tuple[Path, str]:
    try:
        output = store.copy_single_python_source(upload_id, destination, trusted_root)
    except Exception as exc:
        raise UploadSourceError(str(exc) or exc.__class__.__name__) from exc

    try:
        text = output.read_bytes().decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise UploadSourceError("unsupported_encoding") from exc
    except OSError as exc:
        raise UploadSourceError(str(exc) or exc.__class__.__name__) from exc
    return output, text
