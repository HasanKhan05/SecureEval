from __future__ import annotations

import os
import re
import sys
import tempfile
from pathlib import Path

from app.schemas import TestExecution
from app.tools.process import run_command


def _count(output: str, outcome: str) -> int:
    match = re.search(rf"\b(\d+)\s+{outcome}\b", output)
    return int(match.group(1)) if match else 0


def run_pytest(tests: Path, source: Path, timeout_seconds: float) -> TestExecution:
    tests = tests.resolve(strict=True)
    source = source.resolve(strict=True)
    environment = {
        "PYTHONPATH": os.pathsep.join(
            part for part in (str(source), os.environ.get("PYTHONPATH", "")) if part
        )
    }
    with tempfile.TemporaryDirectory(prefix="secureeval-pytest-") as temp_dir:
        process = run_command(
            [
                sys.executable,
                "-m",
                "pytest",
                str(tests),
                "-o",
                "addopts=",
                "-q",
                "--disable-warnings",
                f"--basetemp={Path(temp_dir) / 'run'}",
            ],
            tests.parent,
            timeout_seconds,
            environment,
        )
    output = process.output
    status = (
        "completed"
        if process.return_code in {0, 1}
        else process.status
    )
    return TestExecution(
        status=status,
        passed=_count(output, "passed"),
        failed=_count(output, "failed"),
        skipped=_count(output, "skipped"),
        duration_ms=process.duration_ms,
        output=output,
        output_truncated=process.output_truncated,
    )
