from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from time import monotonic
from typing import Literal, Mapping


MAX_OUTPUT_CHARS = 65_536
ProcessStatus = Literal["completed", "failed", "timeout", "unavailable"]


@dataclass(frozen=True)
class ProcessResult:
    status: ProcessStatus
    return_code: int | None
    stdout: str
    stderr: str
    duration_ms: int
    output_truncated: bool

    @property
    def output(self) -> str:
        return "\n".join(part for part in (self.stdout, self.stderr) if part)


def _bounded(stdout: str | bytes | None, stderr: str | bytes | None) -> tuple[str, str, bool]:
    def decoded(value: str | bytes | None) -> str:
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
        return value or ""

    standard = decoded(stdout)
    error = decoded(stderr)
    combined_size = len(standard) + len(error)
    if combined_size <= MAX_OUTPUT_CHARS:
        return standard, error, False
    remaining = MAX_OUTPUT_CHARS
    limited_standard = standard[:remaining]
    remaining -= len(limited_standard)
    return limited_standard, error[:remaining], True


def run_command(
    arguments: list[str],
    cwd: Path,
    timeout_seconds: float,
    environment: Mapping[str, str | None] | None = None,
) -> ProcessResult:
    resolved_cwd = cwd.resolve(strict=True)
    process_environment = os.environ.copy()
    if environment:
        for name, value in environment.items():
            if value is None:
                process_environment.pop(name, None)
            else:
                process_environment[name] = value
    started = monotonic()
    try:
        completed = subprocess.run(
            arguments,
            cwd=resolved_cwd,
            env=process_environment,
            shell=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        stdout, stderr, truncated = _bounded(exc.stdout, exc.stderr)
        return ProcessResult(
            status="timeout",
            return_code=None,
            stdout=stdout,
            stderr=stderr,
            duration_ms=round((monotonic() - started) * 1000),
            output_truncated=truncated,
        )
    except OSError as exc:
        return ProcessResult(
            status="unavailable",
            return_code=None,
            stdout="",
            stderr=str(exc),
            duration_ms=round((monotonic() - started) * 1000),
            output_truncated=False,
        )

    stdout, stderr, truncated = _bounded(completed.stdout, completed.stderr)
    return ProcessResult(
        status="completed" if completed.returncode == 0 else "failed",
        return_code=completed.returncode,
        stdout=stdout,
        stderr=stderr,
        duration_ms=round((monotonic() - started) * 1000),
        output_truncated=truncated,
    )
