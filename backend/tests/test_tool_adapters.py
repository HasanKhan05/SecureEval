from pathlib import Path

from app.tools.bandit import run_bandit
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


def test_fixture_functionality_passes_before_repair() -> None:
    result = run_pytest(FIXTURE / "tests", FIXTURE / "source", 30)

    assert result.status == "completed"
    assert result.failed == 0
    assert result.passed == 2


def test_process_timeout_is_reported_without_raising(tmp_path: Path) -> None:
    from app.tools.process import run_command

    result = run_command(
        ["python", "-c", "import time; time.sleep(2)"],
        tmp_path,
        0.05,
    )

    assert result.status == "timeout"
    assert result.return_code is None
