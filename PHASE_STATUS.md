# Phase Status Tracker

Update this file at every phase closeout. Codex self-review/check evidence is mandatory every time. The user's external AI review is mandatory before closure only for Phases 2, 4, 5, 6, 7, and 9.

| Phase | Scope | Status | External QA reviewer / evidence | External specialist reviewer / evidence | Risks updated | Commit | Push | Remaining/blocker |
|---|---|---|---|---|---|---|---|---|
| 0 | Figma baseline, repository inventory, documentation | Complete (closed) | Not required | Not required; Codex Figma baseline self-review PASS (unchanged UI-source hashes + rendered landing smoke) | R-01, R-02, R-35–R-37 | `2727a75b96dae8b2fde0dbccae0da774436ac31f` | Pushed | None; stop before Phase 1 |
| 1 | FastAPI foundation, SQLite, typed contracts, job lifecycle | In progress | Not required | Not required; independent Codex API reviewer fixes verified | R-03, R-04, R-28, R-31, R-38-R-39 | — | — | Final QA passed; implementation commit pending |
| 2 | Sandbox foundation and secure upload intake | Not started | Required | Security reviewer: required | — | — | — | — |
| 3 | Bandit/Semgrep selected-category pipeline | Not started | Not required | Not required | — | — | — | — |
| 4 | 24-task benchmark corpus and protected evaluator | Not started | Required | Reproducibility reviewer: required | — | — | — | — |
| 5 | Fixed repair strategies, Run All, retest/rescan, metrics | Not started | Required | Benchmark reviewer: required | — | — | — | — |
| 6 | LLM gateway, reviewer, structured contracts | Not started | Required | LLM/security reviewer: required | — | — | — | — |
| 7 | Result interpretation and Figma UI integration | Not started | Required | Figma/LLM reviewer: required | — | — | — | — |
| 8 | Reproducibility, exports, token/cost performance | Not started | Not required | Not required | — | — | — | — |
| 9 | Full independent QA, security, replay, release gate | Not started | Required | Final release reviewer: required | — | — | — | — |

## Required phase entry

```markdown
## Phase N closeout — YYYY-MM-DD
Completed scope:
Checks run and results:
Codex self-review/checks: evidence and result
External review (required only for phases 2, 4, 5, 6, 7, 9): reviewer, evidence, PASS/BLOCK
RISK.md updates:
Commit SHA:
Push state: pushed | blocked (reason) | not attempted (reason)
Remaining work/blockers:
```

## Phase 0 closeout — 2026-08-25

Completed scope:
- Imported the complete 30-file Figma Make export under `frontend/` without
  changing runtime UI source.
- Imported the governing planning package at repository root.
- Added the backend/frontend layout, secret-free environment examples, local
  development documentation, a typed public API contract draft, and a complete
  mock/timer/static-result/asset-to-API inventory.

Checks run and results:
- `corepack pnpm install --frozen-lockfile` — PASS; lockfile unchanged, 43
  packages installed, supply-chain policy check passed.
- `corepack pnpm build` — PASS; Vite 8.0.5 built 16 modules and emitted HTML,
  CSS, JS, and `robots.txt`.
- `corepack pnpm exec tsc --noEmit` — PASS; no diagnostics.
- Preview HTTP smoke — PASS; `/`, compiled JS, and compiled CSS returned 200.
- Headless Edge render smoke — PASS; exit 0, 62,751-byte screenshot, rendered
  DOM contains `SecureEval` and `Start Evaluation`, and no Vite error overlay.
- Core UI SHA-256 comparison — PASS for `src/App.tsx`, `src/index.css`,
  `src/main.tsx`, and `vite.config.ts` against the supplied archive.

Codex self-review/checks: PASS. Reviewed the Figma export, mock-to-contract map,
asset gaps, secret handling, governing-document consistency, and source hashes.
No visual source changed. The preferred browser CLI was unavailable and the
in-app browser session was blocked by the Codex sandbox refresh defect; the
HTTP and headless Edge checks are the recorded fallback evidence.

External review (required only for phases 2, 4, 5, 6, 7, 9): Not required.

RISK.md updates: R-01 marked Observed; R-02 retained Open with preservation
evidence; R-35, R-36, and R-37 added as Observed.

Commit SHA: `2727a75b96dae8b2fde0dbccae0da774436ac31f`

Push state: Pushed to `origin/phase-0-baseline-contracts`.

Remaining work/blockers: None for Phase 0. Phase 1 is not started. Contract,
taxonomy, and documentation inconsistencies remain tracked for their governing
phases.
