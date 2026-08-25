from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.enums import JobStatus, Mode, ModeLabel, ScanCategoryId, StrategyId
from app.uploads.policy import UploadPurpose


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RunCreate(StrictModel):
    mode: Mode
    task_id: str | None = Field(default=None, min_length=6, max_length=128)
    upload_id: str | None = Field(default=None, min_length=8, max_length=128)
    custom_prompt: str | None = Field(default=None, min_length=20, max_length=4000)
    scan_categories: list[ScanCategoryId] = Field(min_length=1, max_length=5)
    strategies: list[StrategyId | Literal["run_all"]] = Field(min_length=1, max_length=3)

    @model_validator(mode="after")
    def validate_contract(self) -> "RunCreate":
        if len(set(self.scan_categories)) != len(self.scan_categories):
            raise ValueError("scan categories must be unique")

        if "run_all" in self.strategies:
            if self.strategies != ["run_all"]:
                raise ValueError("run_all cannot be combined with strategy identifiers")
        elif len(set(self.strategies)) != len(self.strategies):
            raise ValueError("strategies must be unique")

        if self.mode == Mode.BENCHMARK:
            valid = (
                self.task_id is not None
                and self.upload_id is None
                and self.custom_prompt is None
            )
        elif self.mode == Mode.CUSTOM_PROMPT:
            valid = self.task_id is None and self.custom_prompt is not None
        else:
            valid = (
                self.task_id is None
                and self.upload_id is not None
                and self.custom_prompt is None
            )
        if not valid:
            raise ValueError("input fields do not match the selected mode")
        return self


class AttemptSummary(BaseModel):
    attempt_id: str
    strategy_id: StrategyId
    status: JobStatus
    failure_code: str | None = None


class RunResponse(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    run_id: str
    mode: Mode
    mode_label: ModeLabel
    official_eligible: bool
    status: JobStatus
    attempt_summaries: list[AttemptSummary]
    manifest_hash: str
    created_at: datetime
    updated_at: datetime
    failure_code: str | None = None
    failure_message: str | None = None


class HealthResponse(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    status: Literal["ok"] = "ok"
    service: Literal["secureeval-api"] = "secureeval-api"

class UploadReceipt(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    upload_id: str
    purpose: UploadPurpose
    file_count: int
    total_bytes: int
    content_hash: str
    retention_class: Literal["exploratory_24h"] = "exploratory_24h"
    created_at: datetime
    expires_at: datetime
