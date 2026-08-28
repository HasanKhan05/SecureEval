from pathlib import Path

from source.app import read_document


def test_read_document_returns_utf8_content(tmp_path: Path) -> None:
    (tmp_path / "guide.txt").write_text("SecureEval guide", encoding="utf-8")

    assert read_document(str(tmp_path), "guide.txt") == "SecureEval guide"


def test_read_document_supports_nested_documents(tmp_path: Path) -> None:
    nested = tmp_path / "docs"
    nested.mkdir()
    (nested / "notes.txt").write_text("notes", encoding="utf-8")

    assert read_document(str(tmp_path), "docs/notes.txt") == "notes"
