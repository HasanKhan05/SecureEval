# Architecture

## System boundary

`Figma React client → FastAPI API/job coordinator → SQLite + artifact store → ephemeral Docker executor → Bandit/Semgrep/pytest + LLM provider`

The client is a presentation layer. FastAPI owns state, authorization boundaries, job orchestration, metrics, and all privileged artifacts. The executor has no direct client access. Hidden benchmark evaluator data is a distinct protected service/package boundary and is never mounted into repair-model containers or returned through public APIs.

## Components

| Component | Responsibility |
|---|---|
| React/TypeScript UI | Preserve Figma UI; call typed API client; render asynchronous state and safe reports |
| FastAPI API | Validate requests; expose catalog/runs/reports; enqueue/cancel work; redact responses |
| Run coordinator | Immutable run manifest, strategy fan-out, state transitions, artifact provenance |
| Docker executor | Ephemeral untrusted-code workspace; tests/scans/patch application under policy |
| Scanner adapter | Run Bandit/Semgrep with pinned rules; normalize/deduplicate findings |
| Evaluator | Protected Benchmark-only hidden tests/ground-truth comparison and deterministic scoring inputs |
| LLM gateway | Compact/versioned prompts, schema validation, usage/cost/latency capture, retry/fallback |
| SQLite + artifact storage | Run metadata, manifests, findings, metrics, references to bounded immutable artifacts |

## Core data entities

- `BenchmarkTask(task_id, corpus_version, public_source_ref, public_tests_ref, risk_mix, active)`
- `Run(run_id, mode, status, official_eligible, immutable_manifest_hash, source_revision)`
- `StrategyAttempt(attempt_id, run_id, strategy_id, baseline_artifact, candidate_artifact, state)`
- `Assessment(assessment_id, attempt_id, phase, test_result, scan_policy_version)`
- `Finding(finding_id, assessment_id, category, tool, rule_id, file_ref, line, fingerprint, severity)`
- `LLMInvocation(invocation_id, role, template_version, model_config_hash, usage, cost, latency, validation_state)`
- `MetricRecord(attempt_id, metric_version, security_effectiveness, functionality, tokens, cost, latency, efficiency)`
- `ReviewerVerdict(attempt_id, blinded_label, state, structured_result_ref)`
- `Artifact(artifact_id, content_hash, kind, retention_class, redacted_log_ref)`

## Job states and failure model

Allowed states: `queued`, `running`, `completed`, `failed`, `cancelled`. Attempts also record structured failure codes (`validation_error`, `upload_rejected`, `sandbox_timeout`, `tool_error`, `model_error`, `schema_invalid`, `internal_error`). Failures are data, not silently converted into a zero score without a reason.

## API outline

`GET /api/v1/tasks` exposes public catalog metadata only.

`POST /api/v1/runs` creates and freezes a run configuration.

`POST /api/v1/runs/{id}/start`, `POST /cancel`, `GET /status`, and `GET /report` manage jobs.

`POST /api/v1/uploads` validates/stores exploratory code intake.

`GET /api/v1/aggregates/official` queries only `official_eligible=true` benchmark runs matching a complete pinned manifest.

All request/response types are Pydantic models; public response schemas exclude paths, secrets, raw hidden evidence, and unrestricted logs.
