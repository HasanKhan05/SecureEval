import re
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def test_backend_dependency_lock_is_complete_and_hashed() -> None:
    lock_path = BACKEND_ROOT / "pylock.toml"
    assert lock_path.is_file()

    lock_text = lock_path.read_text(encoding="utf-8")
    assert 'lock-version = "1.0"' in lock_text
    assert lock_text.count("[[packages]]") >= 20
    assert len(re.findall(r'sha256 = "[0-9a-f]{64}"', lock_text)) >= 20

    pyproject_text = (BACKEND_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert 'requires-python = "==3.14.*"' in pyproject_text

    development_guide = (
        BACKEND_ROOT.parent / "docs" / "LOCAL_DEVELOPMENT.md"
    ).read_text(encoding="utf-8")
