import sys
from collections.abc import Callable
from pathlib import Path

import pytest

from app.tools.bandit import ScanResult, run_bandit
from app.tools.process import ProcessResult, run_command
from app.tools.pytest_runner import run_pytest
from app.tools.semgrep import run_semgrep


FIXTURE = Path(__file__).parents[1] / "app" / "fixtures" / "benchmark_t01"


def test_real_scanners_find_fixture_sql_injection() -> None:
    source = FIXTURE / "source"

    bandit = run_bandit(source, 30)
    semgrep = run_semgrep(source, 30)

    assert bandit.status == "completed"
    assert semgrep.status == "completed"
    assert {item.rule_id for item in bandit.findings} >= {"B608"}
    assert {item.rule_id for item in semgrep.findings} >= {
        "secureeval.python.sql-injection"
    }
    assert all(not Path(item.filename).is_absolute() for item in bandit.findings)
    assert all(not Path(item.filename).is_absolute() for item in semgrep.findings)


@pytest.mark.parametrize(
    "scanner",
    [run_bandit, run_semgrep],
    ids=["bandit", "semgrep"],
)
@pytest.mark.parametrize("module_name", ["bandit.py", "sitecustomize.py"])
def test_static_scanners_never_execute_modules_from_scanned_source(
    tmp_path: Path,
    scanner: Callable[[Path, float], ScanResult],
    module_name: str,
) -> None:
    source = tmp_path / "untrusted"
    source.mkdir()
    marker = tmp_path / f"{module_name}.executed"
    (source / module_name).write_text(
        "from pathlib import Path\n"
        f"Path({marker.as_posix()!r}).write_text('executed', encoding='utf-8')\n",
        encoding="utf-8",
    )

    scanner(source, 30)

    assert not marker.exists()


def test_static_scanners_launch_from_trusted_cwd_with_absolute_target_and_safe_env(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.tools import bandit as bandit_adapter
    from app.tools import semgrep as semgrep_adapter

    source = (tmp_path / "untrusted").resolve()
    source.mkdir()
    (source / "audit.py").write_text("value = 1\n", encoding="utf-8")
    launches: list[tuple[list[str], Path, dict[str, str | None]]] = []

    def completed(
        arguments: list[str],
        cwd: Path,
        _timeout: float,
        environment: dict[str, str | None] | None = None,
    ) -> ProcessResult:
        launches.append((arguments, cwd.resolve(), environment or {}))
        return ProcessResult("completed", 0, '{"results": []}', "", 1, False)

    monkeypatch.setattr(bandit_adapter, "run_command", completed)
    monkeypatch.setattr(semgrep_adapter, "run_command", completed)

    bandit_adapter.run_bandit(source, 30)
    semgrep_adapter.run_semgrep(source, 30)

    assert len(launches) == 2
    for arguments, cwd, environment in launches:
        assert cwd != source
        assert str(source) in arguments
        assert arguments[-1] != "."
        assert environment["PYTHONPATH"] is None
        assert environment["PYTHONHOME"] is None
        assert environment["PYTHONSTARTUP"] is None
        assert environment["PYTHONINSPECT"] is None
        assert environment["PYTHONSAFEPATH"] == "1"
    assert "-I" in launches[0][0]


def test_fixture_functionality_passes_before_repair() -> None:
    result = run_pytest(FIXTURE / "tests", FIXTURE / "source", 30)

    assert result.status == "completed"
    assert result.failed == 0
    assert result.passed == 2


def test_process_environment_can_remove_hostile_python_variables(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PYTHONINSPECT", "1")

    result = run_command(
        [
            sys.executable,
            "-c",
            "import os; print(os.environ.get('PYTHONINSPECT', 'missing'))",
        ],
        tmp_path,
        5,
        environment={"PYTHONINSPECT": None},
    )

    assert result.status == "completed"
    assert result.stdout.strip() == "missing"


def test_process_timeout_is_reported_without_raising(tmp_path: Path) -> None:
    from app.tools.process import run_command

    result = run_command(
        ["python", "-c", "import time; time.sleep(2)"],
        tmp_path,
        0.05,
    )

    assert result.status == "timeout"
    assert result.return_code is None
