from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.enums import (
    ALL_STRATEGIES,
    JobStatus,
    Mode,
    ModeLabel,
    ScanCategoryId,
    StrategyId,
)
from app.uploads.policy import UploadPurpose


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class RunCreate(StrictModel):
    mode: Mode
    task_id: str | None = Field(default=None, min_length=4, max_length=128)
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

ToolStatus = Literal["completed", "failed", "timeout", "unavailable", "cancelled"]
RunStage = Literal[
    "queued",
    "baseline_testing",
    "baseline_scanning",
    "awaiting_strategy",
    "repairing",
    "repaired_testing",
    "repaired_scanning",
    "reviewing",
    "reporting",
    "completed",
    "failed",
    "cancelled",
]


class Finding(StrictModel):
    finding_id: str = Field(min_length=8, max_length=64)
    scanner: Literal["bandit", "semgrep"]
    rule_id: str = Field(min_length=1, max_length=160)
    category: ScanCategoryId
    severity: Literal["low", "medium", "high"]
    confidence: Literal["low", "medium", "high"] | None = None
    filename: str = Field(min_length=1, max_length=256)
    line_start: int = Field(ge=1)
    line_end: int = Field(ge=1)
    message: str = Field(min_length=1, max_length=4000)


class TestExecution(StrictModel):
    status: ToolStatus
    passed: int = Field(ge=0)
    failed: int = Field(ge=0)
    skipped: int = Field(ge=0)
    duration_ms: int = Field(ge=0)
    output: str = Field(max_length=65536)
    output_truncated: bool


class LlmUsage(StrictModel):
    source: Literal["llm", "local_fallback"]
    provider: str | None = Field(default=None, max_length=64)
    model: str | None = Field(default=None, max_length=128)
    status: ToolStatus | Literal["invalid_response"]
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    estimated_cost_usd: float = Field(ge=0)
    latency_ms: int = Field(ge=0)
    retries: int = Field(ge=0, le=3)


class StrategyMetrics(StrictModel):
    findings_before: int = Field(ge=0)
    findings_after: int = Field(ge=0)
    fixed_count: int = Field(ge=0)
    security_score: float = Field(ge=0, le=100)
    functionality_score: float = Field(ge=0, le=100)
    overall_score: float = Field(ge=0, le=100)
    efficiency_score: float = Field(ge=0, le=100)


class StrategyResult(StrictModel):
    attempt_id: str = Field(min_length=8, max_length=64)
    strategy_id: StrategyId
    status: JobStatus
    repaired_code: str = Field(max_length=200000)
    repair_summary: str = Field(min_length=1, max_length=4000)
    limitations: list[str] = Field(max_length=20)
    repaired_findings: list[Finding]
    repaired_scan_status: ToolStatus = "completed"
    repaired_tests: TestExecution
    llm_usage: LlmUsage
    review: str = Field(min_length=1, max_length=8000)
    metrics: StrategyMetrics


class RunProgress(StrictModel):
    run_id: str = Field(min_length=8, max_length=64)
    status: JobStatus
    stage: RunStage
    completed_stages: list[RunStage]
    current_strategy: StrategyId | None = None

class StrategySelection(StrictModel):
    strategies: list[StrategyId | Literal["run_all"]] = Field(
        min_length=1, max_length=3
    )

    @model_validator(mode="after")
    def validate_selection(self) -> "StrategySelection":
        if "run_all" in self.strategies:
            if self.strategies != ["run_all"]:
                raise ValueError("run_all cannot be combined with strategy identifiers")
        elif len(set(self.strategies)) != len(self.strategies):
            raise ValueError("strategies must be unique")
        return self

    def expanded(self) -> list[StrategyId]:
        if self.strategies == ["run_all"]:
            return list(ALL_STRATEGIES)
        return [StrategyId(item) for item in self.strategies]

class RunReport(StrictModel):
    schema_version: Literal["1.0"] = "1.0"
    run_id: str = Field(min_length=8, max_length=64)
    status: JobStatus
    mode: Mode
    baseline_source: str = Field(max_length=200000)
    baseline_findings: list[Finding]
    baseline_scan_status: ToolStatus = "completed"
    baseline_tests: TestExecution
    strategy_results: list[StrategyResult]
    best_overall: StrategyId | None
    best_efficiency: StrategyId | None
    explanation: str = Field(min_length=1, max_length=12000)
    explanation_source: Literal["llm", "local_fallback"]
    limitations: list[str] = Field(max_length=20)
    created_at: datetime
