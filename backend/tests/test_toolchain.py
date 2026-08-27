import importlib.util
import shutil
import subprocess
from pathlib import Path


def test_real_analysis_toolchain_and_fixture_are_runnable() -> None:
    root = Path(__file__).parents[1]

    for command in ("bandit", "semgrep"):
        executable = shutil.which(command)
        assert executable is not None
        completed = subprocess.run(
            [executable, "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert completed.returncode == 0

    assert importlib.util.find_spec("pandas") is not None
    assert importlib.util.find_spec("httpx") is not None
    assert (root / "app/fixtures/benchmark_t01/source/app.py").is_file()
    assert (root / "app/fixtures/benchmark_t01/tests/test_app.py").is_file()
    assert (root / "app/fixtures/benchmark_t01/fixture.json").is_file()
