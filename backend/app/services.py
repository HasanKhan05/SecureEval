import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.enums import ALL_STRATEGIES, MODE_LABELS, JobStatus, StrategyId
from app.errors import APIError
from app.manifests import canonical_manifest, manifest_hash
from app.models import RunRecord, StrategyAttemptRecord
from app.schemas import AttemptSummary, RunCreate, RunResponse



def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _expanded_strategies(payload: RunCreate) -> list[StrategyId]:
    if payload.strategies == ["run_all"]:
        return list(ALL_STRATEGIES)
    selected = {StrategyId(item) for item in payload.strategies}
    return [strategy for strategy in ALL_STRATEGIES if strategy in selected]




def _load_run(session: Session, run_id: str) -> RunRecord:
    statement = (
        select(RunRecord)
        .where(RunRecord.run_id == run_id)
        .options(selectinload(RunRecord.attempts))
    )
    record = session.scalar(statement)
    if record is None:
        raise APIError(404, "run_not_found", "Run not found.")
    return record


def _to_response(record: RunRecord) -> RunResponse:
    return RunResponse(
        run_id=record.run_id,
        mode=record.mode,
        mode_label=record.mode_label,
        official_eligible=record.official_eligible,
        status=record.status,
        attempt_summaries=[
            AttemptSummary(
                attempt_id=item.attempt_id,
                strategy_id=item.strategy_id,
                status=item.status,
                failure_code=item.failure_code,
            )
            for item in record.attempts
        ],
        manifest_hash=record.manifest_hash,
        created_at=record.created_at,
        updated_at=record.updated_at,
        failure_code=record.failure_code,
        failure_message=record.failure_message,
    )


def create_run(session: Session, payload: RunCreate) -> RunResponse:
    strategies = _expanded_strategies(payload)
    timestamp = _now()
    run_id = _new_id("run")
    manifest_json = canonical_manifest(
        payload,
        strategies,
        run_id=run_id,
        created_at=timestamp,
    )
    categories = sorted(item.value for item in payload.scan_categories)
    record = RunRecord(
        run_id=run_id,
        mode=payload.mode.value,
        mode_label=MODE_LABELS[payload.mode],
        task_id=payload.task_id,
        upload_id=payload.upload_id,
        custom_prompt=payload.custom_prompt,
        scan_categories_json=json.dumps(categories, separators=(",", ":")),
        official_eligible=False,
        status=JobStatus.QUEUED.value,
        manifest_json=manifest_json,
        manifest_hash=manifest_hash(manifest_json),
        created_at=timestamp,
        updated_at=timestamp,
        attempts=[
            StrategyAttemptRecord(
                attempt_id=_new_id("attempt"),
                ordinal=index,
                strategy_id=strategy.value,
                status=JobStatus.QUEUED.value,
            )
            for index, strategy in enumerate(strategies)
        ],
    )
    session.add(record)
    session.commit()
    return _to_response(_load_run(session, record.run_id))


def get_run(session: Session, run_id: str) -> RunResponse:
    return _to_response(_load_run(session, run_id))


def start_run(session: Session, run_id: str) -> RunResponse:
    record = _load_run(session, run_id)
    if record.status != JobStatus.QUEUED.value:
        raise APIError(409, "invalid_state_transition", "Run cannot be started.")
    record.status = JobStatus.RUNNING.value
    record.updated_at = _now()
    for attempt in record.attempts:
        attempt.status = JobStatus.RUNNING.value
    session.commit()
    return _to_response(_load_run(session, run_id))


def cancel_run(session: Session, run_id: str) -> RunResponse:
    record = _load_run(session, run_id)
    if record.status == JobStatus.CANCELLED.value:
        return _to_response(record)
    if record.status not in {JobStatus.QUEUED.value, JobStatus.RUNNING.value}:
        raise APIError(409, "invalid_state_transition", "Run cannot be cancelled.")
    record.status = JobStatus.CANCELLED.value
    record.updated_at = _now()
    for attempt in record.attempts:
        if attempt.status in {JobStatus.QUEUED.value, JobStatus.RUNNING.value}:
            attempt.status = JobStatus.CANCELLED.value
    session.commit()
    return _to_response(_load_run(session, run_id))
