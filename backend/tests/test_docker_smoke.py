from pathlib import Path

import pytest

from app.schemas import TestExecution as ExecutionResult
from app.tools.docker_smoke import run_docker_smoke
from app.tools.process import ProcessResult


def test_smoke_uses_only_restricted_docker_execution(tmp_path: Path) -> None:
    trusted = (tmp_path / "trusted").resolve()
    trusted.mkdir()
    source = trusted / "program.py"
    source.write_text("print('ok')\n", encoding="utf-8")
    launches: list[tuple[list[str], Path, float]] = []

    def runner(arguments: list[str], cwd: Path, timeout: float) -> ProcessResult:
        launches.append((arguments, cwd, timeout))
        return ProcessResult("completed", 0, "ok\n", "", 12, False)

    result = run_docker_smoke(source, trusted, 5, runner=runner)

    assert result == ExecutionResult(
        status="completed", passed=1, failed=0, skipped=0,
        duration_ms=12, output="ok\n", output_truncated=False,
    )
    arguments, cwd, timeout = launches[0]
    assert arguments[:3] == ["docker", "run", "--rm"]
    assert cwd == trusted
    assert timeout == 5
    for required in (
        "none", "--read-only", "128m", "0.5", "64", "ALL",
        "no-new-privileges:true", "/tmp:rw,noexec,nosuid,nodev,size=16777216",
    ):
        assert required in arguments
    assert ["python", "-I", "-B", "/workspace/program.py"] == arguments[-4:]
    mount = arguments[arguments.index("--mount") + 1]
    assert f"source={source}" in mount
    assert "target=/workspace/program.py" in mount
    assert mount.endswith(",readonly")
    assert str(source) not in arguments[-4:]


@pytest.mark.parametrize("filename", ["program.txt", "nested/../program.py"])
def test_smoke_rejects_invalid_source_target(tmp_path: Path, filename: str) -> None:
    trusted = (tmp_path / "trusted").resolve()
    trusted.mkdir()
    source = trusted / filename
    source.parent.mkdir(parents=True, exist_ok=True)
    source.write_text("print('no')\n", encoding="utf-8")

    with pytest.raises(ValueError):
        run_docker_smoke(source, trusted, 5)


def test_smoke_rejects_source_outside_trusted_root(tmp_path: Path) -> None:
    trusted = (tmp_path / "trusted").resolve()
    trusted.mkdir()
    source = (tmp_path / "program.py").resolve()
    source.write_text("print('no')\n", encoding="utf-8")

    with pytest.raises(ValueError, match="trusted root"):
        run_docker_smoke(source, trusted, 5)


@pytest.mark.parametrize(
    ("process_status", "return_code", "expected_status", "passed", "failed"),
    [
        ("failed", 7, "failed", 0, 1),
        ("unavailable", None, "unavailable", 0, 0),
    ],
)
def test_smoke_maps_failure_states(
    tmp_path: Path,
    process_status: str,
    return_code: int | None,
    expected_status: str,
    passed: int,
    failed: int,
) -> None:
    trusted = (tmp_path / "trusted").resolve()
    trusted.mkdir()
    source = trusted / "program.py"
    source.write_text("print('x')\n", encoding="utf-8")

    def runner(arguments: list[str], cwd: Path, timeout: float) -> ProcessResult:
        return ProcessResult(process_status, return_code, "", "engine error", 4, False)  # type: ignore[arg-type]

    result = run_docker_smoke(source, trusted, 5, runner=runner)

    assert result.status == expected_status
    assert result.passed == passed
    assert result.failed == failed
    assert result.output == "engine error"


def test_smoke_timeout_forces_named_container_cleanup(tmp_path: Path) -> None:
    trusted = (tmp_path / "trusted").resolve()
    trusted.mkdir()
    source = trusted / "program.py"
    source.write_text("while True: pass\n", encoding="utf-8")
    launches: list[list[str]] = []

    def runner(arguments: list[str], cwd: Path, timeout: float) -> ProcessResult:
        launches.append(arguments)
        if arguments[:2] == ["docker", "run"]:
            return ProcessResult("timeout", None, "", "", 5000, False)
        return ProcessResult("completed", 0, "", "", 1, False)

    result = run_docker_smoke(source, trusted, 5, runner=runner)

    assert result.status == "timeout"
    container_name = launches[0][launches[0].index("--name") + 1]
    assert launches[1] == ["docker", "rm", "--force", container_name]
