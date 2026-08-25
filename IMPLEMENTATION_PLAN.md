# SecureEval Phased Implementation Plan

> **For agentic workers:** REQUIRED WORKFLOW: self-test and self-review every phase. Prepare a phase evidence package for the user's separate external AI reviewer only at high-risk gates (Phases 2, 4, 5, 6, 7, and 9), and wait for its Pass verdict before commit/push at those gates. Update `PHASE_STATUS.md` after each phase.

**Goal:** Deliver a reproducible FastAPI-backed SecureEval platform while retaining the supplied Figma Make user interface.

**Architecture:** The React/Figma client uses typed API contracts; FastAPI coordinates immutable research runs, SQLite metadata, restricted Docker execution, scanners, deterministic scoring, and strictly bounded LLM roles. Benchmark evaluation has a protected ground-truth boundary; exploratory modes are excluded server-side from official aggregates.

**Tech Stack:** React/TypeScript/Vite/Tailwind, FastAPI/Python, SQLite, Pydantic, pandas, pytest, Bandit, Semgrep, Docker.

**Spec:** `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `BENCHMARK_PROTOCOL.md`, `SECURITY_DESIGN.md`, `LLM_OUTPUT_CONTRACTS.md`, and `REPRODUCIBILITY.md` in this package.

## Global constraints

- Retain Figma UI design and replace only mocked behavior/data plumbing.
- Execute untrusted code only in the documented sandbox boundary.
- Use the pinned official configuration for official Benchmark Mode experiments.
- Calculate all measurements, eligibility, and rankings deterministically in Python.
- Never include Custom Prompt or Upload Existing Code runs in official aggregate data.
- Every phase must pass Codex’s relevant checks and self-review before commit/push. Phases 2, 4, 5, 6, 7, and 9 additionally require external Antigravity Pass.

---

> Execute sequentially. Each phase is an evidence checkpoint, not a promise of completion. Codex self-reviews every phase; the user's external AI reviews the high-risk gates only.

## Universal phase gate

Implement → self-check and focused Codex self-review → update `RISK.md` → update `PHASE_STATUS.md` → commit/push if checks pass. At Phases 2, 4, 5, 6, 7, and 9: pause before commit/push, hand evidence to Antigravity, and proceed only after its Pass. Preserve Figma UI in every frontend change.

## Phase 0 — Baseline and contracts

Inventory the complete supplied Figma export; identify all mocks/timers/static results and every referenced asset. Establish backend/frontend directory layout, local development documentation, typed API contract draft, environment examples without secrets, and the planning docs. Acceptance: Figma app still builds unchanged; inventory records missing assets; reviewer confirms no visual redesign. QA: frontend build/smoke. Specialist: Figma regression reviewer.

## Phase 1 — Backend foundation

Create FastAPI application, Pydantic schemas, SQLite persistence, migrations, error envelope, health endpoint, run/job state machine, and typed frontend API client. Implement mode labels and official-eligibility field at creation. Acceptance: create/read/cancel lifecycle works through UI-compatible API; invalid input yields safe structured errors; no client-controlled metrics. QA: contract/integration tests. Specialist: API reviewer.

## Phase 2 — Isolated execution and uploads

Implement pinned Docker executor with safety policy and bounded artifact/log collection. Implement Custom Prompt source intake and Upload Existing Code validation/retention boundary. Acceptance: hostile archive/path/symlink/binary cases reject; executor has policy evidence; cleanup occurs for success/failure/cancel. QA: integration plus hostile-input suite. Specialist: sandbox/security reviewer.

## Phase 3 — Baseline assessment pipeline

Implement public functional test execution and category-selective Bandit/Semgrep adapters, pinned rules, normalized deterministic findings, baseline artifact capture, and UI status rendering. Acceptance: each selected category records exact tools/rules; unselected categories are visibly skipped; normalized output is deterministic. QA: scanner fixture suite. Specialist: scanner reviewer.

## Phase 4 — Official benchmark boundary

Add exactly 24 versioned public tasks and a protected evaluator-only hidden package/service. Implement corpus manifest/hash, official eligibility predicate, and absence-of-leak tests. Acceptance: public catalog is 24 tasks; repair/reviewer/API cannot access hidden assets; aggregate query rejects exploratory/mismatched configs. QA: benchmark integration tests. Specialist: benchmark/reproducibility reviewer.

## Phase 5 — Repair execution and scoring

Implement the three fixed strategy templates and Run All fan-out from one immutable baseline. Apply validated patches in separate sandboxes, re-test/re-scan, collect LLM/tool usage, and calculate versioned deterministic metrics, best overall, and best efficiency. Acceptance: no strategy contamination; ranking/ties/failed attempts are deterministic; all aggregates use backend predicate. QA: end-to-end fixture runs. Specialist: benchmark reviewer.

## Phase 6 — LLM gateway and independent review

Implement compact prompt builders, official model config freeze, gateway instrumentation, strict schema parsing/bounded retry, and blinded independent reviewer. Acceptance: no raw secret/hidden truth in prompts; invalid JSON uses defined state/fallback; reviewer cannot override metrics or see strategy/score. QA: contract/failure tests. Specialist: LLM contract and security reviewer.

## Phase 7 — Interpretation and preserved UI integration

Replace Figma mock data/timers with real status/report endpoints. Add concise structured interpretation with deterministic fallback, strategy comparison, evidence/limitations, and persistent exploratory exclusion labels. Acceptance: all key existing screens render real job states/errors/results without redesign; no invented interpretation facts. QA: UI/API E2E. Specialist: Figma and LLM reviewers.

## Phase 8 — Reproducibility and efficiency

Finalize manifests, artifact hashes, replay command, version displays, official exports, token/cost/latency dashboards, prompt-context minimization, and caching of safe immutable preprocessing. Acceptance: clean replay verifies hashes; config changes create a separate experiment version; exports exclude exploratory runs. QA: replay/export tests. Specialist: reproducibility reviewer.

## Phase 9 — Release validation

Run full suite and clean-environment setup; independently inspect sandbox, corpus boundary, metrics, LLM contracts, and UI. Record release limitations and unresolved risks. Acceptance: all mandatory checks/evidence pass, release reviewer accepts, phase tracker records commit/push truthfully. QA: final integration reviewer. Specialists: security, benchmark/reproducibility, Figma, and LLM reviewers.
