from sqlalchemy import create_engine, inspect

from app.database import upgrade_database


def test_initial_migration_creates_run_and_attempt_tables(database_url: str) -> None:
    upgrade_database(database_url)

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert set(inspector.get_table_names()) >= {
            "alembic_version",
            "runs",
            "strategy_attempts",
        }
        run_columns = {item["name"]: item for item in inspector.get_columns("runs")}
        assert run_columns["manifest_json"]["nullable"] is False
        assert run_columns["official_eligible"]["nullable"] is False
        attempt_columns = {
            item["name"]: item for item in inspector.get_columns("strategy_attempts")
        }
        assert attempt_columns["ordinal"]["nullable"] is False
        index_names = {item["name"] for item in inspector.get_indexes("strategy_attempts")}
        assert "ix_strategy_attempts_run_id" in index_names
        foreign_keys = inspector.get_foreign_keys("strategy_attempts")
        assert any(item["referred_table"] == "runs" for item in foreign_keys)
    finally:
        engine.dispose()

def test_phase2_migration_creates_private_artifact_and_audit_metadata(
    database_url: str,
) -> None:
    upgrade_database(database_url)

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert {"upload_artifacts", "audit_events"} <= set(
            inspector.get_table_names()
        )
        artifact_columns = {
            item["name"]: item for item in inspector.get_columns("upload_artifacts")
        }
        assert set(artifact_columns) == {
            "upload_id",
            "purpose",
            "state",
            "storage_key",
            "content_hash",
            "file_count",
            "total_bytes",
            "retention_class",
            "created_at",
            "expires_at",
            "bound_run_id",
            "deleted_at",
        }
        assert "path" not in artifact_columns
        assert artifact_columns["content_hash"]["nullable"] is False
        index_names = {
            item["name"] for item in inspector.get_indexes("upload_artifacts")
        }
        assert {"ix_upload_artifacts_expires_at", "ix_upload_artifacts_bound_run_id"} <= index_names
        audit_columns = {
            item["name"] for item in inspector.get_columns("audit_events")
        }
        assert audit_columns == {
            "event_id",
            "event_type",
            "subject_id",
            "reason_code",
            "created_at",
        }
    finally:
        engine.dispose()
