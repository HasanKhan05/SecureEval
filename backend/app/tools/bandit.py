from __future__ import annotations

import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from app.schemas import Finding, ToolStatus
from app.tools.process import ProcessResult, run_command


@dataclass(frozen=True)
class ScanResult:
    status: ToolStatus
    findings: list[Finding]
    output: str
    output_truncated: bool
    duration_ms: int


def _finding_id(scanner: str, rule_id: str, filename: str, line: int) -> str:
    value = f"{scanner}:{rule_id}:{filename}:{line}".encode()
    return f"finding_{hashlib.sha256(value).hexdigest()[:32]}"


def _failure(process: ProcessResult) -> ScanResult:
    return ScanResult(
        status=process.status,
        findings=[],
        output=process.output,
        output_truncated=process.output_truncated,
        duration_ms=process.duration_ms,
    )


def run_bandit(source: Path, timeout_seconds: float) -> ScanResult:
    source = source.resolve(strict=True)
    process = run_command(
        [sys.executable, "-m", "bandit", "-r", ".", "-f", "json", "-q"],
        source,
        timeout_seconds,
    )
    if process.status in {"timeout", "unavailable"}:
        return _failure(process)
    try:
        payload = json.loads(process.stdout)
        raw_findings = payload.get("results", [])
    except (json.JSONDecodeError, AttributeError):
        return _failure(process)

    findings: list[Finding] = []
    for item in raw_findings:
        reported_path = Path(item["filename"])
        resolved_path = (
            reported_path.resolve()
            if reported_path.is_absolute()
            else (source / reported_path).resolve()
        )
        filename = resolved_path.relative_to(source).as_posix()
        rule_id = str(item["test_id"])
        line = max(1, int(item.get("line_number", 1)))
        findings.append(
            Finding(
                finding_id=_finding_id("bandit", rule_id, filename, line),
                scanner="bandit",
                rule_id=rule_id,
                category="injection" if rule_id == "B608" else "input_validation",
                severity=str(item.get("issue_severity", "medium")).lower(),
                confidence=str(item.get("issue_confidence", "medium")).lower(),
                filename=filename,
                line_start=line,
                line_end=max(line, int(item.get("end_line", line))),
                message=str(item.get("issue_text", "Bandit finding.")),
            )
        )
    return ScanResult(
        status="completed",
        findings=findings,
        output=process.output,
        output_truncated=process.output_truncated,
        duration_ms=process.duration_ms,
    )
