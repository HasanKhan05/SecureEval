# Real Custom Prompt and Isolated Smoke Execution Design

## Goal

Connect Custom Prompt Mode to a real OpenAI-compatible API and evaluate the generated Python module with syntax validation, Bandit, Semgrep, deterministic repair comparison, persistence, and an optional isolated Docker smoke execution.

## Scope

- Custom Prompt requires a configured `SECUREEVAL_LLM_API_KEY` and `SECUREEVAL_LLM_MODEL`. There is no generated-code fallback.
- The API request uses strict Structured Outputs with a single `code` field and real usage metadata. OpenAI documents Structured Outputs as schema-constrained model output: https://developers.openai.com/api/docs/guides/structured-outputs.
- Generated content is accepted only when it is one valid Python module, contains no Markdown fence, is UTF-8 text, and is at most 100 KB.
- Generated code is never executed directly on the host.
- Docker smoke execution is optional at runtime. If the Linux Docker engine is unavailable, the report records execution as `unavailable` and continues with syntax and scanner evidence.
- Custom Prompt results are exploratory and excluded from official benchmark aggregates.

## Data flow

1. The frontend creates a `custom_prompt` run with the prompt, scan categories, and initial strategy.
2. Starting the run calls the configured API with a strict `GeneratedProgram` schema.
3. The backend validates the returned code and records actual provider/model/token/cost/latency metadata.
4. The backend validates syntax, runs a restricted Docker smoke execution, then runs Bandit and Semgrep.
5. The existing repair strategies call the real API. A missing or failed API result fails that attempt honestly; Custom Prompt never substitutes deterministic generated or repaired code.
6. Each repaired candidate is syntax-validated, smoke-executed in Docker when available, rescanned, scored, and persisted.
7. The frontend renders real progress, generated source, scanner findings, smoke-execution status, strategy comparison, usage, and limitations.

## Docker execution contract

The runner invokes the local Docker CLI with a fixed Python image and these constraints:

- `--network none`
- `--read-only`
- `--memory 128m`
- `--cpus 0.5`
- `--pids-limit 64`
- `--cap-drop ALL`
- `--security-opt no-new-privileges`
- a read-only mount containing only `program.py`
- a writable size-limited temporary filesystem for `/tmp`
- a hard process timeout followed by process-tree termination

The command runs `python -I -B /workspace/program.py`. Standard output and error are captured, bounded, and presented as smoke-execution evidence. Exit code zero means only that the module completed in this constrained invocation; it does not establish functional correctness.

## API and schema changes

- Add evaluation kind `custom_prompt_smoke` and score basis `static_smoke`.
- Add `GeneratedProgram` with exactly one `code` field.
- Reuse `TestExecution` for smoke execution, with UI copy that never calls it a trusted functional test.
- Preserve the current run lifecycle and endpoints.
- Persist the generated source only in the private local report/database, never in browser storage or logs.

## UI behavior

- Keep the Figma layout and existing Custom Prompt form.
- Replace demo progression with the live controller.
- Before submission, explain that a real API key/model are required and Docker enables isolated smoke execution.
- Missing API configuration, provider failure, invalid code, Docker unavailable, timeout, cancellation, and success are distinct states.
- Never show deterministic-demo labels, fabricated token values, or a functional-test claim for Custom Prompt.

## Verification

- Contract tests for structured generation, missing configuration, malformed/non-code output, and actual usage propagation.
- Docker command-boundary tests and an opt-in live Docker smoke test.
- Pipeline tests for success, API failure, Docker unavailable, timeout, repairs, persistence, cancellation, and source privacy.
- Frontend contract and browser tests for live Custom Prompt success/error/refresh states.

## Non-goals

- General-purpose secure code hosting.
- Networked generated programs.
- User-supplied dependencies or package installation.
- A claim that smoke execution proves functionality or security.

