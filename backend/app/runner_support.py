from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session, sessionmaker

from app.enums import JobStatus
from app.llm.client import LlmClient
from app.models import RunRecord
from app.schemas import ToolStatus
from app.uploads.store import ArtifactStore


@dataclass(frozen=True)
class RunnerDependencies:
    fixture_root: Path
    work_root: Path
    tool_timeout_seconds: float
    llm_client: LlmClient
    artifact_store: ArtifactStore


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def progress_payload(record: RunRecord) -> dict[str, object]:
    return json.loads(record.progress_json or "{}")


def combined_scan_status(*statuses: ToolStatus) -> ToolStatus:
    if all(status == "completed" for status in statuses):
        return "completed"
    for status in ("cancelled", "timeout", "unavailable"):
        if status in statuses:
            return status
    return "failed"


def set_stage(
    session: Session,
    record: RunRecord,
    stage: str,
    *,
    completed_stage: str | None = None,
    extra: dict[str, object] | None = None,
) -> None:
    payload = progress_payload(record)
    completed = list(payload.get("completed_stages", []))
    if completed_stage and completed_stage not in completed:
        completed.append(completed_stage)
    payload["completed_stages"] = completed
    if extra:
        payload.update(extra)
    record.stage = stage
    record.progress_json = json.dumps(payload, separators=(",", ":"))
    record.updated_at = _now()
    session.commit()


def fail_run(
    session_factory: sessionmaker[Session],
    run_id: str,
    code: str,
    message: str,
) -> None:
    with session_factory() as session:
        record = session.get(RunRecord, run_id)
        if record is None or record.status == JobStatus.CANCELLED.value:
            return
        record.status = JobStatus.FAILED.value
        record.stage = "failed"
        record.failure_code = code
        record.failure_message = message[:256]
        record.updated_at = _now()
        for attempt in record.attempts:
            if attempt.status != JobStatus.COMPLETED.value:
                attempt.status = JobStatus.FAILED.value
                attempt.failure_code = code
        session.commit()


def run_cancelled(session: Session, run_id: str) -> bool:
    session.expire_all()
    record = session.get(RunRecord, run_id)
    return record is None or record.status == JobStatus.CANCELLED.value


def cleanup_run(dependencies: RunnerDependencies, run_id: str) -> None:
    shutil.rmtree(dependencies.work_root / run_id, ignore_errors=True)