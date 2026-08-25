from __future__ import annotations

import hashlib
import io
import json
import re
import stat
import zipfile
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.uploads.policy import UploadPolicy

WINDOWS_RESERVED_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{number}" for number in range(1, 10)),
    *(f"lpt{number}" for number in range(1, 10)),
}
WINDOWS_INVALID_CHARACTERS = frozenset('<>:"|?*')


@dataclass(frozen=True)
class ValidatedFile:
    path: str
    content: bytes


@dataclass(frozen=True)
class ValidatedSource:
    files: tuple[ValidatedFile, ...]
    total_bytes: int
    manifest_json: str
    content_hash: str


class UploadRejected(ValueError):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def _normalize_path(raw_path: str, policy: UploadPolicy) -> str:
    normalized = raw_path.replace("\\", "/")
    raw_parts = normalized.split("/")
    if (
        normalized.startswith("/")
        or re.match(r"^[A-Za-z]:", normalized)
        or any(part in {"", ".", ".."} for part in raw_parts)
    ):
        raise UploadRejected("unsafe_path")
    for part in raw_parts:
        if (
            part.endswith((" ", "."))
            or any(character in WINDOWS_INVALID_CHARACTERS for character in part)
            or any(ord(character) < 32 for character in part)
            or part.split(".", 1)[0].casefold() in WINDOWS_RESERVED_NAMES
        ):
            raise UploadRejected("unsafe_path")
    path = PurePosixPath(normalized)
    if path.is_absolute() or not path.parts:
        raise UploadRejected("unsafe_path")
    if len(path.parts) > policy.max_path_depth or len(path.as_posix()) > policy.max_path_length:
        raise UploadRejected("unsafe_path")
    if path.suffix.lower() in {".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z"}:
        raise UploadRejected("nested_archive")
    if path.suffix.lower() not in policy.allowed_extensions:
        raise UploadRejected("unsupported_type")
    return path.as_posix()


def _validated_zip_metadata(
    archive: zipfile.ZipFile, policy: UploadPolicy
) -> list[tuple[zipfile.ZipInfo, str]]:
    entries: list[tuple[zipfile.ZipInfo, str]] = []
    seen: set[str] = set()
    for item in archive.infolist():
        if item.flag_bits & 0x1:
            raise UploadRejected("encrypted_archive")
        mode = (item.external_attr >> 16) & 0xFFFF
        file_type = stat.S_IFMT(mode)
        if file_type == stat.S_IFLNK:
            raise UploadRejected("symlink")
        if file_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
            raise UploadRejected("special_file")
        if item.is_dir():
            continue
        normalized = _normalize_path(item.filename, policy)
        identity = normalized.casefold()
        if identity in seen:
            raise UploadRejected("duplicate_path")
        seen.add(identity)
        entries.append((item, normalized))
    if not entries:
        raise UploadRejected("empty_input")
    if len(entries) > policy.max_file_count:
        raise UploadRejected("too_many_files")
    expanded_bytes = sum(item.file_size for item, _ in entries)
    if expanded_bytes > policy.max_expanded_bytes:
        raise UploadRejected("expanded_too_large")
    compressed_bytes = sum(item.compress_size for item, _ in entries)
    if expanded_bytes > policy.max_expansion_ratio * max(compressed_bytes, 1):
        raise UploadRejected("expansion_ratio_exceeded")
    return entries


def _validated_file(path: str, content: bytes, policy: UploadPolicy) -> ValidatedFile:
    normalized = _normalize_path(path, policy)
    if not content:
        raise UploadRejected("empty_input")
    try:
        decoded = content.decode("utf-8", errors="strict")
    except UnicodeDecodeError as exc:
        raise UploadRejected("unsupported_encoding") from exc
    if any(ord(character) < 32 and character not in "\t\n\r\f" for character in decoded):
        raise UploadRejected("binary_content")
    return ValidatedFile(path=normalized, content=content)


def _manifest(files: tuple[ValidatedFile, ...]) -> tuple[str, str]:
    total_bytes = sum(len(item.content) for item in files)
    manifest_json = json.dumps(
        {
            "files": [
                {
                    "path": item.path,
                    "sha256": f"sha256:{hashlib.sha256(item.content).hexdigest()}",
                    "size": len(item.content),
                }
                for item in files
            ],
            "schema_version": "1.0",
            "total_bytes": total_bytes,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    content_hash = f"sha256:{hashlib.sha256(manifest_json.encode('utf-8')).hexdigest()}"
    return manifest_json, content_hash


def validate_source(filename: str, payload: bytes, policy: UploadPolicy) -> ValidatedSource:
    if len(payload) > policy.max_upload_bytes:
        raise UploadRejected("upload_too_large")

    if filename.lower().endswith(".zip"):
        try:
            with zipfile.ZipFile(io.BytesIO(payload)) as archive:
                metadata = _validated_zip_metadata(archive, policy)
                files = tuple(
                    _validated_file(path, archive.read(item), policy)
                    for item, path in metadata
                )
        except zipfile.BadZipFile as exc:
            raise UploadRejected("invalid_archive") from exc
    else:
        files = (_validated_file(filename, payload, policy),)

    files = tuple(sorted(files, key=lambda item: item.path))
    manifest_json, content_hash = _manifest(files)
    return ValidatedSource(
        files=files,
        total_bytes=sum(len(item.content) for item in files),
        manifest_json=manifest_json,
        content_hash=content_hash,
    )
