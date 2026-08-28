from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from uuid import uuid4

from app.sandbox.policy import PINNED_IMAGE
from app.schemas import TestExecution
from app.tools.process import ProcessResult, run_command


CommandRunner = Callable[[list[str], Path, float], ProcessResult]


def _validated_source(source_file: Path, trusted_root: Path) -> tuple[Path, Path]:
    if not source_file.is_absolute() or not trusted_root.is_absolute():
        raise ValueError("source and trusted root must be absolute")
    resolved_root = trusted_root.resolve(strict=True)
    resolved_source = source_file.resolve(strict=True)
    if source_file != resolved_source:
        raise ValueError("source path must be canonical")
    if not resolved_source.is_relative_to(resolved_root):
        raise ValueError("source must be inside the trusted root")
    if not resolved_source.is_file() or resolved_source.suffix != ".py":
        raise ValueError("source must be a Python file")
    if "," in str(resolved_source):
        raise ValueError("source path is not mount-safe")
    return resolved_source, resolved_root


def run_docker_smoke(
    source_file: Path,
    trusted_root: Path,
    timeout_seconds: float,
    *,
    runner: CommandRunner = run_command,
) -> TestExecution:
    source, root = _validated_source(source_file, trusted_root)
    container_name = f"secureeval-smoke-{uuid4().hex}"
    arguments = [
        "docker", "run", "--rm",
        "--name", container_name,
        "--platform", "linux/amd64",
        "--network", "none",
        "--user", "65532:65532",
        "--read-only",
        "--memory", "128m",
        "--cpus", "0.5",
        "--pids-limit", "64",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges:true",
        "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16777216",
        "--env", "PYTHONDONTWRITEBYTECODE=1",
        "--env", "PYTHONUNBUFFERED=1",
        "--mount", f"type=bind,source={source},target=/workspace/program.py,readonly",
        PINNED_IMAGE,
        "python", "-I", "-B", "/workspace/program.py",
    ]
    result = runner(arguments, root, timeout_seconds)
    if result.status == "timeout":
        runner(["docker", "rm", "--force", container_name], root, 10)

    status = result.status
    unavailable_markers = (
        "dockerdesktoplinuxengine",
        "cannot connect to the docker daemon",
        "is the docker daemon running",
    )
    if status == "failed" and any(
        marker in result.output.lower() for marker in unavailable_markers
    ):
        status = "unavailable"
    failed = 1 if status == "failed" else 0
    passed = 1 if status == "completed" else 0
    return TestExecution(
        status=status,
        passed=passed,
        failed=failed,
        skipped=0,
        duration_ms=result.duration_ms,
        output=result.output,
        output_truncated=result.output_truncated,
    )
