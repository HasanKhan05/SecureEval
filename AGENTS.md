# SecureEval Agent Operating Rules

## Purpose

This file governs Codex working in the SecureEval repository. Codex self-tests and self-reviews each phase; independent external Antigravity review is reserved for high-risk gates: Phases 2, 4, 5, 6, 7, and 9.

## Non-negotiable rules

- Preserve the Figma Make UI. Replace behavior/data plumbing, not the visual design, unless an approved accessibility or integration issue requires a narrowly documented change.
- Treat hidden benchmark data and all uploads as sensitive/untrusted.
- Do not put secrets in commits, prompts, logs, fixtures, screenshots, or client payloads.
- Do not let an LLM calculate official metrics, outcomes, rankings, eligibility, or aggregates.
- Keep official and exploratory data separated in backend predicates, not only labels.
- Keep changes small, typed, tested, and traceable to a phase.
- Before claiming a phase is done, run relevant checks and conduct a focused self-review. Before closing a high-risk gate (Phases 2, 4, 5, 6, 7, or 9), provide evidence to the user's external AI reviewer and wait for its Pass verdict.

## Required phase closeout

1. Codex supplies its diff, acceptance-criteria evidence, exact test commands/results, and self-review findings.
2. For Phases 2, 4, 5, 6, 7, and 9 only, Codex gives the evidence package to the user for external Antigravity review. Antigravity independently reviews the relevant security/sandbox, benchmark/reproducibility, LLM, or Figma concerns.
3. Codex records findings and unresolved limitations in `RISK.md`; the designated future risk-mitigation agent owns mitigations unless separately assigned.
4. Codex updates `PHASE_STATUS.md` with evidence, review state, remaining work, and commit/push state.
5. For routine phases, commit/push after Codex’s checks pass. For high-risk gates, commit/push only when the external verdict is Pass. If no remote/authorization exists, record `push: blocked` without falsely claiming delivery.

## Context and token discipline

- Start each task by reading only the phase, contracts, and files needed.
- Prefer focused diffs and structured evidence over full-repository dumps.
- Store/reuse artifact identifiers and hashes; do not paste large code/log bodies into agent prompts.
- An agent report must state scope, files reviewed, checks run, findings by severity, unverified areas, and `pass`/`block`.

## Change control

Any change to benchmark corpus, scan policy, containers, prompts, model config, metric policy, pricing, or schema is versioned and creates a distinct official experiment configuration. Never mix configuration versions in one official aggregate.
