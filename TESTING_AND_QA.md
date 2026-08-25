# Testing and QA Strategy

## Test layers

| Layer | Required coverage |
|---|---|
| Unit | Pydantic contracts, validators, scan normalization/deduplication, metric formulas/ties, eligibility predicate, pricing/token math, redaction |
| API/integration | Run lifecycle, mode separation, upload rejection, artifact authorization, cancellation, schema-invalid LLM fallback |
| Sandbox | No network, no root/capabilities, resource/time/output limits, cleanup, blocked traversal/symlink/archive attacks |
| Tool pipeline | Bandit/Semgrep category selection, pinned rule versions, baseline/candidate retest-rescan, normalized evidence capture |
| Benchmark | 24-task catalog integrity, hidden truth non-disclosure, evaluator scoring, deterministic replay/aggregate exclusion |
| Frontend | API-state rendering while preserving Figma flows; loading/error/empty/cancelled states and exploration label |
| End-to-end | Each strategy and Run All on known fixtures; no cross-strategy baseline contamination |

## Required regression cases

- An exploratory run cannot appear in any official API aggregate, export, chart query, or winner result.
- A hidden test/ground-truth file cannot be read by repair/reviewer/interpreter/client paths.
- Run All yields independent source hashes/workspaces for every strategy.
- Invalid model JSON cannot be shown as accepted prose; it yields bounded retry then deterministic fallback/failure state.
- A tie produces the documented stable deterministic winner.
- A skipped scan category is explicitly shown as skipped.
- A malicious upload/archive is rejected before execution.

## Phase gate evidence

Codex records exact commands, environment/config version, pass/fail output summary, test counts, and failure investigation after every phase. At Phases 2, 4, 5, 6, 7, and 9, Codex also supplies this evidence to the user's external AI reviewer for an independent verdict. No “looks good” approval is sufficient for those gates.

## Completion gate

Phase 10 requires a clean-environment setup, full automated suite, representative UI walkthrough, independent sandbox review, benchmark replay check, reproducibility-manifest verification, accessibility smoke check, and documented unresolved risks/limitations.
