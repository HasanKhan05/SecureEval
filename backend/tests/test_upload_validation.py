import hashlib
import io
import json
import stat
import zipfile

import pytest

from app.uploads.policy import UploadPolicy
from app.uploads.validation import UploadRejected, validate_source


def _zip_bytes(entries: list[tuple[str, bytes]]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        for path, content in entries:
            archive.writestr(path, content)
    return buffer.getvalue()


def _deflated_zip_bytes(path: str, content: bytes) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(path, content)
    return buffer.getvalue()


def _zip_info_bytes(info: zipfile.ZipInfo, content: bytes = b"safe = True\n") -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr(info, content)
    return buffer.getvalue()


def _mark_zip_encrypted(payload: bytes) -> bytes:
    modified = bytearray(payload)
    local = modified.index(b"PK\x03\x04")
    central = modified.index(b"PK\x01\x02")
    modified[local + 6 : local + 8] = (1).to_bytes(2, "little")
    modified[central + 8 : central + 10] = (1).to_bytes(2, "little")
    return bytes(modified)


def test_single_source_file_has_canonical_manifest_and_hash() -> None:
    content = b"print('safe')\n"
    file_hash = hashlib.sha256(content).hexdigest()
    expected_manifest = json.dumps(
        {
            "files": [
                {
                    "path": "example.py",
                    "sha256": f"sha256:{file_hash}",
                    "size": 14,
                }
            ],
            "schema_version": "1.0",
            "total_bytes": 14,
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    validated = validate_source("example.py", content, UploadPolicy())

    assert [(item.path, item.content) for item in validated.files] == [
        ("example.py", content)
    ]
    assert validated.total_bytes == 14
    assert validated.manifest_json == expected_manifest
    assert validated.content_hash == (
        f"sha256:{hashlib.sha256(expected_manifest.encode('utf-8')).hexdigest()}"
    )


def test_zip_manifest_sorts_normalized_source_paths() -> None:
    payload = _zip_bytes(
        [
            ("src/z.py", b"z = 1\n"),
            ("src/a.py", b"a = 1\n"),
        ]
    )

    validated = validate_source("project.zip", payload, UploadPolicy())

    assert [item.path for item in validated.files] == ["src/a.py", "src/z.py"]
    assert validated.total_bytes == 12

@pytest.mark.parametrize(
    ("filename", "reason"),
    [
        ("../escape.py", "unsafe_path"),
        ("/absolute.py", "unsafe_path"),
        ("C:\\drive.py", "unsafe_path"),
        ("\\\\server\\share.py", "unsafe_path"),
        ("source.py:payload.py", "unsafe_path"),
        ("CON.py", "unsafe_path"),
        ("src/trailing./source.py", "unsafe_path"),
        ("src/bad<name.py", "unsafe_path"),
        ("unsupported.exe", "unsupported_type"),
    ],
)
def test_single_file_rejects_unsafe_or_unsupported_name(
    filename: str, reason: str
) -> None:
    with pytest.raises(UploadRejected) as caught:
        validate_source(filename, b"safe = True\n", UploadPolicy())

    assert caught.value.reason == reason


@pytest.mark.parametrize(
    ("payload", "reason"),
    [
        (_zip_bytes([("../escape.py", b"safe = True\n")]), "unsafe_path"),
        (
            _zip_bytes([("src/A.py", b"a = 1\n"), ("src/a.py", b"a = 2\n")]),
            "duplicate_path",
        ),
        (_zip_bytes([("nested.zip", b"PK\x03\x04")]), "nested_archive"),
        (b"not a zip", "invalid_archive"),
    ],
)
def test_zip_rejects_hostile_metadata(payload: bytes, reason: str) -> None:
    with pytest.raises(UploadRejected) as caught:
        validate_source("project.zip", payload, UploadPolicy())

    assert caught.value.reason == reason


def test_zip_rejects_symlink_entry() -> None:
    info = zipfile.ZipInfo("link.py")
    info.create_system = 3
    info.external_attr = (stat.S_IFLNK | 0o777) << 16

    with pytest.raises(UploadRejected) as caught:
        validate_source("project.zip", _zip_info_bytes(info), UploadPolicy())

    assert caught.value.reason == "symlink"


def test_zip_rejects_special_file_entry() -> None:
    info = zipfile.ZipInfo("pipe.py")
    info.create_system = 3
    info.external_attr = (stat.S_IFIFO | 0o644) << 16

    with pytest.raises(UploadRejected) as caught:
        validate_source("project.zip", _zip_info_bytes(info), UploadPolicy())

    assert caught.value.reason == "special_file"


def test_zip_rejects_encrypted_entry_before_reading_content() -> None:
    encrypted = _mark_zip_encrypted(_zip_bytes([("safe.py", b"safe = True\n")]))

    with pytest.raises(UploadRejected) as caught:
        validate_source("project.zip", encrypted, UploadPolicy())

    assert caught.value.reason == "encrypted_archive"

@pytest.mark.parametrize(
    ("content", "reason"),
    [
        (b"", "empty_input"),
        (b"\xff", "unsupported_encoding"),
        (b"value = 'x\x00y'\n", "binary_content"),
        (b"value = '\x01'\n", "binary_content"),
    ],
)
def test_single_file_rejects_empty_or_binary_content(
    content: bytes, reason: str
) -> None:
    with pytest.raises(UploadRejected) as caught:
        validate_source("source.py", content, UploadPolicy())

    assert caught.value.reason == reason


def test_upload_rejects_transport_size_limit() -> None:
    policy = UploadPolicy(max_upload_bytes=3)

    with pytest.raises(UploadRejected) as caught:
        validate_source("source.py", b"four", policy)

    assert caught.value.reason == "upload_too_large"


def test_zip_rejects_file_count_before_reading_entries() -> None:
    payload = _zip_bytes([("a.py", b"a=1\n"), ("b.py", b"b=1\n")])
    policy = UploadPolicy(max_file_count=1)

    with pytest.raises(UploadRejected) as caught:
        validate_source("source.zip", payload, policy)

    assert caught.value.reason == "too_many_files"


def test_zip_rejects_expanded_size_limit() -> None:
    payload = _zip_bytes([("large.py", b"123456")])
    policy = UploadPolicy(max_expanded_bytes=5)

    with pytest.raises(UploadRejected) as caught:
        validate_source("source.zip", payload, policy)

    assert caught.value.reason == "expanded_too_large"


def test_zip_rejects_excessive_expansion_ratio() -> None:
    payload = _deflated_zip_bytes("compressed.txt", b"a" * 2048)
    policy = UploadPolicy(max_expansion_ratio=2)

    with pytest.raises(UploadRejected) as caught:
        validate_source("source.zip", payload, policy)

    assert caught.value.reason == "expansion_ratio_exceeded"


@pytest.mark.parametrize(
    ("path", "policy"),
    [
        ("a/b/c.py", UploadPolicy(max_path_depth=2)),
        ("too-long.py", UploadPolicy(max_path_length=8)),
    ],
)
def test_zip_rejects_path_policy_limits(path: str, policy: UploadPolicy) -> None:
    with pytest.raises(UploadRejected) as caught:
        validate_source("source.zip", _zip_bytes([(path, b"ok=1\n")]), policy)

    assert caught.value.reason == "unsafe_path"


def test_zip_rejects_archive_with_no_source_files() -> None:
    with pytest.raises(UploadRejected) as caught:
        validate_source("source.zip", _zip_bytes([]), UploadPolicy())

    assert caught.value.reason == "empty_input"
