from pathlib import Path


def read_document(root: str, requested_path: str) -> str:
    return (Path(root) / requested_path).read_text(encoding="utf-8")
