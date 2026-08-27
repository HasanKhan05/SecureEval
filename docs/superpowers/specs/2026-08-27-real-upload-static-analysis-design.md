# Real Upload Code Static Analysis Design

## Objective

Connect SecureEval's existing Upload Code frontend flow to a real local backend pipeline while preserving the supplied Figma interface. Uploaded Python source will be validated, scanned, repaired, rescanned, scored, and persisted without importing or executing untrusted code.

## Scope

The real upload slice supports one pasted or uploaded UTF-8 `.py` file within the existing upload limits. It provides:

- Python syntax validation using `ast.parse`
- Real Bandit and Semgrep scanning
- Existing scan-category filtering
- One or more existing repair strategies, including Run All
- Deterministic local repair fallback and optional structured LLM repair
- Syntax validation and rescanning of every repaired candidate
- Static-security comparison, usage values, explanation, and SQLite persistence
- Refresh recovery, cancellation, and explicit failure states

Functional tests are not run for uploaded code. The UI and report state this explicitly: **Functional tests unavailable — uploaded code was not executed.**

## Architecture

The implementation extends the existing `/api/v1/uploads` and run lifecycle rather than adding a separate audit subsystem.

1. The frontend converts pasted code to a browser `File` when necessary and calls the existing upload endpoint with purpose `uploaded_code`.
2. The frontend creates an `upload` mode run using the returned `upload_id`, selected scan categories, and a temporary strategy placeholder required by the current create contract.
3. The backend claims the artifact using the existing one-run binding and copies the validated `.py` source into a run-specific temporary workspace.
4. The runner validates syntax, runs Bandit and Semgrep, filters findings by selected categories, persists baseline evidence, and pauses at `awaiting_strategy`.
5. After strategy selection, each candidate starts from the same original source, receives the selected repair, is syntax-validated, and is rescanned.
6. The backend builds and persists a mode-aware report, cleans the temporary workspace, and exposes it through the existing progress/report endpoints.

Uploaded bytes remain in the private local artifact store. Reports may contain source and repaired code because the current Figma results experience displays both, but no source is logged or sent to an LLM unless the user configured a model and selected a repair strategy.

## Evidence and scoring

Upload reports distinguish three evidence types:

- `syntax_validation`: real parse result for original and repaired source
- `static_analysis`: real Bandit/Semgrep status and normalized findings
- `functional_tests`: unavailable by policy

Benchmark scoring currently requires functional-test evidence. Upload mode therefore uses a separate static-only score derived deterministically from configured findings before/after and repair cost/latency. It is labeled exploratory and is never mixed into benchmark results.

No winner is selected when syntax validation or required scanner evidence is failed, timed out, unavailable, or cancelled. An empty finding list counts as scanner-clean only when scanner status is `completed`.

## Frontend behavior

The existing Figma flow remains visually intact:

- Upload or paste validation remains on the mode-selection screen.
- The code-preview screen replaces demo confidence claims with actual upload/syntax state.
- Analysis shows real scanner progress and evidence.
- Strategy selection remains unchanged.
- Comparison and Results consume the persisted upload report.
- Functional-test cards display `Unavailable — uploaded code was not executed` rather than zero passes.
- The report is labeled `Exploratory upload analysis` and states that static analysis is not a security guarantee.

The run ID and navigation inputs remain in local storage. Uploaded source is not added to new browser persistence beyond the existing bounded session behavior; report data is reloaded from the backend after refresh.

## Error and cancellation behavior

- Invalid extension, encoding, size, empty input, or unsafe archive content is rejected by the existing upload policy.
- Syntax errors produce an explicit terminal validation failure. Scanning and repair are not presented as completed, and the user can return to edit or replace the source.
- Upload, run creation, start, polling, strategy configuration, scanner, repair, persistence, and cancellation failures remain visible and never fall back to demo results.
- Cancellation between stages prevents later completion and removes the run workspace.
- Transient polling failures use the existing bounded retry behavior.

## Testing

Backend tests will cover:

- upload artifact to run binding
- real Bandit/Semgrep findings from uploaded source
- category filtering
- syntax-valid and syntax-invalid source
- repair, syntax revalidation, rescan, and persistence
- static-only ranking eligibility
- cancellation and workspace cleanup
- proof that uploaded source and uploaded tests are never executed

Frontend contract and browser tests will cover:

- real upload creation and progress
- real scanner findings and repaired results
- explicit unavailable functional-test state
- refresh persistence
- upload/start/scanner failure states
- absence of demo-result fallback
- existing mobile and desktop layouts

## Non-goals

- Executing uploaded source or user-provided tests
- Installing uploaded dependencies
- Supporting ZIP projects in the first connected UI slice
- Real authentication, deployment, cloud storage, or production isolation
- Mixing upload results into controlled benchmark aggregates
- Redesigning the Figma interface

## Completion criteria

The slice is complete when a portfolio viewer can paste or upload a Python file, choose categories and repair strategies, observe real local scanning and repair progress, inspect persisted static evidence and comparison results, refresh without losing the report, and clearly understand that the uploaded program was never executed.
