from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, Literal, TypeVar

from pydantic import Field

from app.schemas import StrictModel


class RepairProposal(StrictModel):
    repaired_code: str = Field(min_length=1, max_length=200_000)
    summary: str = Field(min_length=1, max_length=4_000)
    limitations: list[str] = Field(default_factory=list, max_length=20)


class GeneratedProgram(StrictModel):
    code: str = Field(min_length=1, max_length=100_000)

class ExplanationResponse(StrictModel):
    explanation: str = Field(min_length=1, max_length=12_000)
    limitations: list[str] = Field(default_factory=list, max_length=20)


T = TypeVar("T", bound=StrictModel)
LlmStatus = Literal[
    "completed", "failed", "timeout", "unavailable", "invalid_response"
]


@dataclass(frozen=True)
class LlmResult(Generic[T]):
    value: T | None
    source: Literal["llm", "local_fallback"]
    provider: str | None
    model: str | None
    status: LlmStatus
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    latency_ms: int
    retries: int
