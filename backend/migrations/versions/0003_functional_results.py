"""Create functional analysis and report persistence."""

from alembic import op
import sqlalchemy as sa

revision = "0003_functional_results"
down_revision = "0002_phase2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "runs",
        sa.Column("stage", sa.String(length=64), nullable=False, server_default="queued"),
    )
    op.add_column(
        "runs",
        sa.Column("progress_json", sa.Text(), nullable=False, server_default="{}"),
    )
    op.create_table(
        "findings",
        sa.Column("finding_id", sa.String(length=64), primary_key=True),
        sa.Column("run_id", sa.String(length=64), sa.ForeignKey("runs.run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", sa.String(length=64), sa.ForeignKey("strategy_attempts.attempt_id", ondelete="CASCADE")),
        sa.Column("stage", sa.String(length=32), nullable=False),
        sa.Column("scanner", sa.String(length=32), nullable=False),
        sa.Column("rule_id", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("confidence", sa.String(length=16)),
        sa.Column("filename", sa.String(length=256), nullable=False),
        sa.Column("line_start", sa.Integer(), nullable=False),
        sa.Column("line_end", sa.Integer(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
    )
    op.create_index("ix_findings_run_id", "findings", ["run_id"])
    op.create_index("ix_findings_attempt_id", "findings", ["attempt_id"])
    op.create_table(
        "test_executions",
        sa.Column("test_execution_id", sa.String(length=64), primary_key=True),
        sa.Column("run_id", sa.String(length=64), sa.ForeignKey("runs.run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", sa.String(length=64), sa.ForeignKey("strategy_attempts.attempt_id", ondelete="CASCADE")),
        sa.Column("stage", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("passed", sa.Integer(), nullable=False),
        sa.Column("failed", sa.Integer(), nullable=False),
        sa.Column("skipped", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("output", sa.Text(), nullable=False),
        sa.Column("output_truncated", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_test_executions_run_id", "test_executions", ["run_id"])
    op.create_index("ix_test_executions_attempt_id", "test_executions", ["attempt_id"])
    op.create_table(
        "llm_calls",
        sa.Column("llm_call_id", sa.String(length=64), primary_key=True),
        sa.Column("run_id", sa.String(length=64), sa.ForeignKey("runs.run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempt_id", sa.String(length=64), sa.ForeignKey("strategy_attempts.attempt_id", ondelete="CASCADE")),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("provider", sa.String(length=64)),
        sa.Column("model", sa.String(length=128)),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("estimated_cost_microusd", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("retries", sa.Integer(), nullable=False),
    )
    op.create_index("ix_llm_calls_run_id", "llm_calls", ["run_id"])
    op.create_index("ix_llm_calls_attempt_id", "llm_calls", ["attempt_id"])
    op.create_table(
        "run_reports",
        sa.Column("run_id", sa.String(length=64), sa.ForeignKey("runs.run_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("schema_version", sa.String(length=16), nullable=False),
        sa.Column("report_json", sa.Text(), nullable=False),
        sa.Column("best_overall", sa.String(length=64)),
        sa.Column("best_efficiency", sa.String(length=64)),
        sa.Column("created_at", sa.String(length=32), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("run_reports")
    op.drop_index("ix_llm_calls_attempt_id", table_name="llm_calls")
    op.drop_index("ix_llm_calls_run_id", table_name="llm_calls")
    op.drop_table("llm_calls")
    op.drop_index("ix_test_executions_attempt_id", table_name="test_executions")
    op.drop_index("ix_test_executions_run_id", table_name="test_executions")
    op.drop_table("test_executions")
    op.drop_index("ix_findings_attempt_id", table_name="findings")
    op.drop_index("ix_findings_run_id", table_name="findings")
    op.drop_table("findings")
    op.drop_column("runs", "progress_json")
    op.drop_column("runs", "stage")
