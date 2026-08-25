# SecureEval Planning Package

This package is the handoff for turning the supplied Figma Make frontend into SecureEval: a reproducible AI-security-repair research platform. Keep the visual UI and interaction design; replace all simulated data, timers, and hardcoded outcomes with calls to the real backend.

## Read in this order

1. `MASTER_CODEX_PROMPT.md` — paste this into Codex in the project workspace.
2. `FIGMA_INPUT_CHECKLIST.md` — attach the listed Figma export files with that prompt.
3. `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `API_SPEC.md`, `BENCHMARK_PROTOCOL.md`, and `SECURITY_DESIGN.md` — product and implementation guardrails.
4. `IMPLEMENTATION_PLAN.md` — execute phases in order.
5. `AGENTS.md`, `SUBAGENT_ROLES.md`, and `TESTING_AND_QA.md` — mandatory agent roles and quality gates.
6. `LLM_OUTPUT_CONTRACTS.md` and `REPRODUCIBILITY.md` — validity of LLM-mediated experiments.
7. `RISK.md` — internal register for a separate mitigation agent; it intentionally records risks without prescribing fixes.
8. `PHASE_STATUS.md` — update after every phase.
9. `ANTIGRAVITY_REVIEWER_PROMPT.md` and `ANTIGRAVITY_PHASE_HANDOFF_TEMPLATE.md` — the standing independent-review prompt and the evidence package Codex must give Antigravity at high-risk gates.
10. `USER_PROJECT_RUNBOOK.md` — the exact end-to-end checklist of what to upload and paste into Codex and Antigravity at each stage.

## Non-negotiable delivery rule

Codex self-tests and self-reviews every phase. External Antigravity review is required only at high-risk gates: Phases 2, 4, 5, 6, 7, and 9. Update `RISK.md` and `PHASE_STATUS.md` after every phase; commit/push after Codex’s checks pass, except high-risk gates require an external Pass first.

## Scope boundary

Official benchmark statistics use only Benchmark Mode runs with the pinned dataset, hidden ground truth, pinned tool/container/model configuration, and a recorded run manifest. Custom Prompt Mode and Upload Existing Code Mode are exploratory: they may show per-run results but never affect official aggregate metrics or winners.
