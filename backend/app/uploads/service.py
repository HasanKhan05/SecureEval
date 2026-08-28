from datetime import UTC, datetime
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.enums import JobStatus
from app.models import AuditEventRecord, RunRecord, UploadArtifactRecord
from app.schemas import UploadReceipt
from app.uploads.policy import UploadPolicy, UploadPurpose
from app.uploads.store import ArtifactStore
from app.uploads.validation import UploadRejected, validate_source


def _timestamp(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def _audit(
    session: Session,
    event_type: str,
    *,
    subject_id: str | None = None,
    reason_code: str | None = None,
) -> None:
    session.add(
        AuditEventRecord(
            event_id=f"audit_{uuid4().hex}",
            event_type=event_type,
            subject_id=subject_id,
            reason_code=reason_code,
            created_at=_timestamp(datetime.now(UTC)),
        )
    )


TERMINAL_RUN_STATUSES = {
    JobStatus.COMPLETED.value,
    JobStatus.FAILED.value,
    JobStatus.CANCELLED.value,
}


def cleanup_expired_uploads(
    session: Session,
    store: ArtifactStore,
    *,
    now: datetime | None = None,
) -> tuple[str, ...]:
    current_time = now or datetime.now(UTC)
    expired = session.scalars(
        select(UploadArtifactRecord).where(
            UploadArtifactRecord.deleted_at.is_(None)
        )
    ).all()
    deleted: list[str] = []
    for artifact in expired:
        expires_at = datetime.fromisoformat(
            artifact.expires_at.replace("Z", "+00:00")
        )
        if expires_at > current_time:
            continue
        if artifact.bound_run_id is not None:
            run = session.get(RunRecord, artifact.bound_run_id)
            if run is not None and run.status not in TERMINAL_RUN_STATUSES:
                continue
        store.delete(artifact.upload_id)
        artifact.state = "deleted"
        artifact.deleted_at = _timestamp(current_time)
        _audit(
            session,
            "upload_expired_deleted",
            subject_id=artifact.upload_id,
            reason_code="retention_expired",
        )
        deleted.append(artifact.upload_id)
    if deleted:
        session.commit()
    return tuple(deleted)


async def read_bounded_upload(source: UploadFile, policy: UploadPolicy) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await source.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > policy.max_upload_bytes:
            raise UploadRejected("upload_too_large")
        chunks.append(chunk)
    return b"".join(chunks)


def reject_upload(session: Session, reason: str) -> None:
    _audit(session, "upload_rejected", reason_code=reason)
    session.commit()


def accept_upload(
    session: Session,
    store: ArtifactStore,
    purpose: UploadPurpose,
    filename: str,
    payload: bytes,
    policy: UploadPolicy,
) -> UploadReceipt:
    validated = validate_source(filename, payload, policy)
    artifact = store.store(validated, purpose)
    try:
        record = UploadArtifactRecord(
            upload_id=artifact.upload_id,
            purpose=purpose.value,
            state="available",
            storage_key=artifact.storage_key,
            content_hash=artifact.content_hash,
            file_count=artifact.file_count,
            total_bytes=artifact.total_bytes,
            retention_class="exploratory_24h",
            created_at=_timestamp(artifact.created_at),
            expires_at=_timestamp(artifact.expires_at),
        )
        session.add(record)
        _audit(session, "upload_accepted", subject_id=artifact.upload_id)
        session.commit()
    except BaseException:
        session.rollback()
        store.delete(artifact.upload_id)
        raise
    return UploadReceipt(
        upload_id=artifact.upload_id,
        purpose=purpose,
        file_count=artifact.file_count,
        total_bytes=artifact.total_bytes,
        content_hash=artifact.content_hash,
        created_at=artifact.created_at,
        expires_at=artifact.expires_at,
    )