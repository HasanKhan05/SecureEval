from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class RunRecord(Base):
    __tablename__ = "runs"

    run_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    mode_label: Mapped[str] = mapped_column(String(64), nullable=False)
    task_id: Mapped[str | None] = mapped_column(String(128))
    upload_id: Mapped[str | None] = mapped_column(String(128))
    custom_prompt: Mapped[str | None] = mapped_column(Text)
    scan_categories_json: Mapped[str] = mapped_column(Text, nullable=False)
    official_eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(80), nullable=False)
    manifest_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(32), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(32), nullable=False)
    failure_code: Mapped[str | None] = mapped_column(String(64))
    failure_message: Mapped[str | None] = mapped_column(String(256))
    attempts: Mapped[list["StrategyAttemptRecord"]] = relationship(
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="StrategyAttemptRecord.ordinal",
        lazy="selectin",
    )


class StrategyAttemptRecord(Base):
    __tablename__ = "strategy_attempts"

    attempt_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(
        ForeignKey("runs.run_id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    strategy_id: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    failure_code: Mapped[str | None] = mapped_column(String(64))
    run: Mapped[RunRecord] = relationship(back_populates="attempts")
