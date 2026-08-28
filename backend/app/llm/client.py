from __future__ import annotations

import json
from time import monotonic
from typing import TypeVar

import httpx
from pydantic import ValidationError

from app.llm.contracts import LlmResult
from app.schemas import StrictModel


T = TypeVar("T", bound=StrictModel)
UNSUPPORTED_PORTABLE_SCHEMA_KEYS = frozenset({"default", "minLength", "maxLength"})


def _portable_json_schema(value):
    if isinstance(value, dict):
        return {
            key: _portable_json_schema(item)
            for key, item in value.items()
            if key not in UNSUPPORTED_PORTABLE_SCHEMA_KEYS
        }
    if isinstance(value, list):
        return [_portable_json_schema(item) for item in value]
    return value


class LlmClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        input_price_per_million: float = 0,
        output_price_per_million: float = 0,
        timeout_seconds: float = 30,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key.strip()
        self.model = model.strip()
        self.input_price_per_million = max(0, input_price_per_million)
        self.output_price_per_million = max(0, output_price_per_million)
        self.timeout_seconds = timeout_seconds
        self.transport = transport

    @property
    def available(self) -> bool:
        return bool(self.api_key and self.model and self.base_url)

    def complete(
        self,
        response_type: type[T],
        messages: list[dict[str, str]],
    ) -> LlmResult[T]:
        if not self.available:
            return self._empty("unavailable", latency_ms=0, retries=0)

        started = monotonic()
        last_status = "failed"
        for attempt in range(2):
            try:
                with httpx.Client(
                    timeout=self.timeout_seconds,
                    transport=self.transport,
                ) as client:
                    response = client.post(
                        f"{self.base_url}/chat/completions",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        json={
                            "model": self.model,
                            "messages": messages,
                            "max_completion_tokens": 4_096,
                            "response_format": {
                                "type": "json_schema",
                                "json_schema": {
                                    "name": response_type.__name__,
                                    "strict": True,
                                    "schema": _portable_json_schema(
                                        response_type.model_json_schema()
                                    ),
                                },
                            },
                        },
                    )
                    response.raise_for_status()
                    payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                value = response_type.model_validate_json(content)
                usage = payload.get("usage", {})
                input_tokens = max(0, int(usage.get("prompt_tokens", 0)))
                output_tokens = max(0, int(usage.get("completion_tokens", 0)))
                cost = (
                    input_tokens * self.input_price_per_million
                    + output_tokens * self.output_price_per_million
                ) / 1_000_000
                return LlmResult(
                    value=value,
                    source="llm",
                    provider="openai_compatible",
                    model=self.model,
                    status="completed",
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    estimated_cost_usd=cost,
                    latency_ms=round((monotonic() - started) * 1000),
                    retries=attempt,
                )
            except httpx.TimeoutException:
                last_status = "timeout"
            except (json.JSONDecodeError, ValidationError, KeyError, IndexError, TypeError, ValueError):
                last_status = "invalid_response"
            except httpx.HTTPError:
                last_status = "failed"

        return self._empty(
            last_status,
            latency_ms=round((monotonic() - started) * 1000),
            retries=1,
        )

    def _empty(
        self,
        status: str,
        *,
        latency_ms: int,
        retries: int,
    ) -> LlmResult:
        return LlmResult(
            value=None,
            source="llm",
            provider="openai_compatible" if self.base_url else None,
            model=self.model or None,
            status=status,
            input_tokens=0,
            output_tokens=0,
            estimated_cost_usd=0,
            latency_ms=latency_ms,
            retries=retries,
        )
