# SecureEval Functional Full-Stack Recovery Design

## Goal

Convert the existing polished portfolio demo into a real local AI-security workflow while preserving the Figma UI and the useful FastAPI, SQLite, upload, validation, and run-lifecycle code already present.

## Chosen approach

Keep one React frontend and one FastAPI application. A background thread owned by the local API processes each run; SQLite remains the source of truth and the frontend polls persisted run state. This avoids cloud services and queues while still demonstrating real backend orchestration.

Alternatives rejected:

- Browser-only analysis cannot run Bandit, Semgrep, Pytest, or protect API secrets.
- A separate worker service or queue would add setup and failure modes without improving this portfolio build.

## End-to-end data flow

1. The frontend uploads source when required and creates a run containing the selected mode, task, scan categories, and strategies.
2. Starting the run moves it from `queued` to `running` and launches one local worker.
3. The worker copies an immutable baseline into a per-run working directory.
4. Pytest, Bandit, and Semgrep run as bounded subprocesses. Their machine-readable output is normalized and persisted.
5. Every selected repair strategy receives its own copy of the same baseline. The LLM adapter proposes a complete replacement or patch using only relevant code, findings, failures, and strategy instructions.
6. The backend validates and applies the repair, reruns tests and scanners, records usage and review output, and calculates deterministic scores.
7. The backend stores the report and marks the run `completed`; unexpected errors produce a persisted `failed` state. Cancellation prevents later stages from starting and marks unfinished attempts `cancelled`.
8. The frontend polls the run/report endpoints and renders actual persisted data in the existing Figma screens. Refresh resumes from the saved run identifier.

## Modes

- **Benchmark:** start with a controlled local Python fixture containing source, tests, and expected scanner behavior. The first complete slice will use one fixture; more can be added without changing the pipeline.
- **Upload Code:** run real Bandit and Semgrep scans. Run Pytest only when a supported test bundle exists; otherwise report functionality as `not_available` rather than inventing results.
- **Custom Prompt:** use the LLM to generate Python source, then pass that source through the same scan, test, repair, and scoring pipeline. The fallback generator is explicitly labeled when no API key is configured.

## Backend components

- `runner`: orchestrates stages and owns state transitions.
- `tools`: bounded adapters for Pytest, Bandit, and Semgrep JSON output.
- `llm`: OpenAI-compatible HTTP adapter configured by `SECUREEVAL_LLM_BASE_URL`, `SECUREEVAL_LLM_API_KEY`, and `SECUREEVAL_LLM_MODEL`, plus a deterministic labeled fallback.
- `repairs`: builds strategy-specific prompts, validates structured responses with Pydantic, and applies bounded source changes.
- `scoring`: pure Python calculations for finding counts, test preservation, overall score, efficiency, and rankings. The LLM never calculates these values.
- `reports`: converts persisted records into the frontend result contract.

## Persistence and API

Add SQLite records for normalized findings, test executions, strategy attempt results, LLM calls, and the final report. Preserve existing run and upload identifiers.

Extend the API with detailed run progress and report retrieval. Existing create, start, get, cancel, and upload routes remain compatible. API responses expose real stage/status values and never embed secrets or unrestricted filesystem paths.

## Safety and failure behavior

- Uploaded source is treated as untrusted. Static scanners never execute it.
- Functional tests run only for controlled benchmark fixtures or explicitly supported local test bundles, with time and output limits.
- Tool absence, timeout, invalid JSON, invalid LLM output, patch failure, or provider failure becomes a structured persisted error.
- The fallback path is clearly identified in API data and the UI; it never claims to be a real model response.
- API keys remain server-side and are excluded from logs, responses, fixtures, and commits.

## Frontend integration

Preserve layout, styling, typography, navigation, and responsive behavior. Replace timers and hardcoded result constants behind each screen with API state:

- generation screen: real generation/fallback status;
- analysis screen: actual baseline scan/test stages and findings;
- comparison screen: actual per-strategy repair, test, rescan, review, and usage data;
- results screen: persisted metrics, rankings, explanations, limitations, and errors.

## Verification

- Unit tests for scanner normalization, LLM validation/fallback, scoring, and state transitions.
- API tests for one complete benchmark run, cancellation, failure, persistence, and report retrieval.
- Tool integration tests using a small controlled vulnerable fixture.
- Frontend contract/type tests and a browser test covering the real local benchmark workflow.
- Final checks: backend Pytest suite, frontend typecheck/build, and one complete local run with evidence that Bandit, Semgrep, Pytest, SQLite persistence, scoring, and either real LLM or labeled fallback all participated.

## Delivery order

1. Establish dependencies and the result schema.
2. Complete one real benchmark pipeline through persisted report output.
3. Connect the existing Figma screens to that pipeline.
4. Add Run All, Upload Code, and Custom Prompt through the same orchestration path.
5. Add real LLM review/explanation and finish end-to-end verification.

