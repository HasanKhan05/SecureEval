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
