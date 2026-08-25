"""Create Phase 2 upload artifact and audit metadata."""

from alembic import op
import sqlalchemy as sa

revision = "0002_phase2"
down_revision = "0001_phase1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "upload_artifacts",
        sa.Column("upload_id", sa.String(length=64), primary_key=True),
        sa.Column("purpose", sa.String(length=32), nullable=False),
        sa.Column("state", sa.String(length=32), nullable=False),
        sa.Column("storage_key", sa.String(length=64), nullable=False, unique=True),
        sa.Column("content_hash", sa.String(length=80), nullable=False),
        sa.Column("file_count", sa.Integer(), nullable=False),
        sa.Column("total_bytes", sa.Integer(), nullable=False),
        sa.Column("retention_class", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.String(length=32), nullable=False),
        sa.Column("expires_at", sa.String(length=32), nullable=False),
        sa.Column("bound_run_id", sa.String(length=64), sa.ForeignKey("runs.run_id")),
        sa.Column("deleted_at", sa.String(length=32)),
    )
    op.create_index(
        "ix_upload_artifacts_expires_at", "upload_artifacts", ["expires_at"]
    )
    op.create_index(
        "ix_upload_artifacts_bound_run_id", "upload_artifacts", ["bound_run_id"]
    )
    op.create_table(
        "audit_events",
        sa.Column("event_id", sa.String(length=64), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("subject_id", sa.String(length=64)),
        sa.Column("reason_code", sa.String(length=64)),
        sa.Column("created_at", sa.String(length=32), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_index("ix_upload_artifacts_bound_run_id", table_name="upload_artifacts")
    op.drop_index("ix_upload_artifacts_expires_at", table_name="upload_artifacts")
    op.drop_table("upload_artifacts")