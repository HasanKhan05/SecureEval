from __future__ import annotations

import json
from pathlib import Path

from app.schemas import Finding
from app.tools.bandit import ScanResult, _failure, _finding_id
from app.tools.process import run_command


CONFIG = Path(__file__).parents[2] / "config" / "semgrep-python.yml"


def run_semgrep(source: Path, timeout_seconds: float) -> ScanResult:
    source = source.resolve(strict=True)
    process = run_command(
        [
            "semgrep",
            "--config",
            str(CONFIG),
            "--json",
            "--quiet",
            "--no-git-ignore",
            ".",
        ],
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
        path = Path(item["path"])
        resolved_path = path.resolve() if path.is_absolute() else (source / path).resolve()
        filename = resolved_path.relative_to(source).as_posix()
        rule_id = str(item["check_id"])
        local_rule_prefix = "secureeval.python."
        if local_rule_prefix in rule_id:
            rule_id = rule_id[rule_id.index(local_rule_prefix) :]
        line = max(1, int(item["start"]["line"]))
        extra = item.get("extra", {})
        metadata = extra.get("metadata", {})
        severity = str(extra.get("severity", "WARNING")).lower()
        severity = {"warning": "medium", "error": "high", "info": "low"}.get(
            severity, severity
        )
        findings.append(
            Finding(
                finding_id=_finding_id("semgrep", rule_id, filename, line),
                scanner="semgrep",
                rule_id=rule_id,
                category=metadata.get("category", "input_validation"),
                severity=severity,
                confidence=None,
                filename=filename,
                line_start=line,
                line_end=max(line, int(item["end"]["line"])),
                message=str(extra.get("message", "Semgrep finding.")),
            )
        )
    return ScanResult(
        status="completed",
        findings=findings,
        output=process.output,
        output_truncated=process.output_truncated,
        duration_ms=process.duration_ms,
    )
