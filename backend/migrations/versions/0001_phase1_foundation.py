"""Create Phase 1 run lifecycle tables."""

from alembic import op
import sqlalchemy as sa

revision = "0001_phase1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("run_id", sa.String(length=64), primary_key=True),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("mode_label", sa.String(length=64), nullable=False),
        sa.Column("task_id", sa.String(length=128)),
        sa.Column("upload_id", sa.String(length=128)),
        sa.Column("custom_prompt", sa.Text()),
        sa.Column("scan_categories_json", sa.Text(), nullable=False),
        sa.Column("official_eligible", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("manifest_hash", sa.String(length=80), nullable=False),
        sa.Column("manifest_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.String(length=32), nullable=False),
        sa.Column("updated_at", sa.String(length=32), nullable=False),
        sa.Column("failure_code", sa.String(length=64)),
        sa.Column("failure_message", sa.String(length=256)),
    )
    op.create_table(
        "strategy_attempts",
        sa.Column("attempt_id", sa.String(length=64), primary_key=True),
        sa.Column("run_id", sa.String(length=64), sa.ForeignKey("runs.run_id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("strategy_id", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("failure_code", sa.String(length=64)),
    )
    op.create_index("ix_strategy_attempts_run_id", "strategy_attempts", ["run_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_strategy_attempts_run_id", table_name="strategy_attempts")
    op.drop_table("strategy_attempts")
    op.drop_table("runs")
