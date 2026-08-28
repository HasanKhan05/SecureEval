# Task 6 report — real static upload evidence

## Scope

Implemented the upload-static rendering branch in the existing Figma screens. Benchmark-mode rendering remains on its existing copy and data paths.

## Files changed

- `frontend/src/LiveScreens.tsx`
- `frontend/src/LiveScreens.contract-test.ts`
- `frontend/src/App.tsx`

## Implementation

- Added a typed rendering-copy contract for `upload_static` and verified it RED before implementation, then GREEN with TypeScript.
- Upload screens now identify the run as `Exploratory upload analysis`, show syntax status, backend-provided unavailable functional-test evidence, scanner status/findings, source code, token/cost/latency, and static-only scores.
- Static uploads never show a functionality percentage. Failed repair results, unavailable scanners, and null syntax render as unavailable rather than as a clean result or a winner.
- The final upload report only presents ranking language when completed static evidence supports it, and repeats that static analysis is not a security guarantee.
- Pre-analysis upload copy now says code is sent only to the local SecureEval backend for static analysis and is never executed; tests are context-only and neither uploaded nor executed.

## Checks

| Command | Result |
| --- | --- |
| `corepack pnpm exec tsc --noEmit` | PASS |
| `corepack pnpm verify:responsive` | PASS — 390px and 1440px |
| `corepack pnpm verify:real-benchmark` | PASS — real T-01 workflow completed |
| `git diff --check` | PASS |

## Self-review

- Verified all exact static-only labels are present: `Exploratory upload analysis`, `Syntax valid`, `Functional tests unavailable — uploaded code was not executed.`, and `Static-only score`.
- Scanner labels remain report-driven (`Bandit · <rule>` and `Semgrep · <rule>`), so real rule IDs such as `Bandit · B608` and `Semgrep · secureeval.python.sql-injection` render without demo substitution.
- 390px and 1440px existing responsive routes pass. The newly added source panel is width-contained and scrollable; the strategy table retains its existing horizontal-scroll structure.
- Benchmark visual/copy behavior is protected by the passing real T-01 regression, with all new text gated to upload/static mode.

## Findings and limitations

- No blocking findings.
- The true real-upload browser RED assertion file is intentionally not created here: Task 7 owns `verify-real-upload.mjs` by the task-boundary ruling. This task uses the focused typed copy contract plus TypeScript and existing responsive/benchmark checks.
- No source/report body is persisted by this task and no dependency was added.

## Status

pass

## Fix Round 1 — static score evidence guard

### Scope

- Preserved and completed the pending `LiveScreens` score-evidence guard.
- Upload static-only numeric scores, efficiency scores, and winner framing now all rely on `hasStaticScoreEvidence`.
- The predicate requires valid baseline and repaired syntax, completed baseline and repaired scanners, completed strategy status, and `score_basis: static_only`.
- The typed contract cases prove valid completed evidence enables the predicate and null or invalid baseline/repaired syntax disables it. Benchmark mode bypasses this upload-only guard.

### Checks

| Command | Output / result |
| --- | --- |
| `corepack pnpm exec tsc --noEmit` | PASS (exit 0; no diagnostics) |
| `corepack pnpm verify:responsive` | PASS — `Responsive layout verified at 390px and 1440px.` |
| `corepack pnpm verify:real-benchmark` | PASS (exit 0) — `node scripts/verify-real-benchmark.mjs` completed successfully |
| `git diff --check` | PASS (exit 0; no whitespace errors) |
