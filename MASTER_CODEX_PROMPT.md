# SecureEval — Master Codex Prompt

You are the lead implementation agent for **SecureEval**, a research platform that evaluates LLM-assisted security-code repair. Start from the supplied Figma Make React frontend. Preserve its visual system, screens, navigation, layout, copy hierarchy, and motion wherever feasible. Replace only simulated/hardcoded state, fake results, artificial timers, and placeholder actions with real frontend-to-backend integrations. Do not redesign the product.

## Mandatory workflow

1. Read `AGENTS.md`, `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `SECURITY.md`, `TESTING_AND_QA.md`, `LLM_OUTPUT_CONTRACTS.md`, `REPRODUCIBILITY.md`, `RISK.md`, `PHASE_STATUS.md`, and `IMPLEMENTATION_PLAN.md` before editing.
2. Inventory the Figma project files and map each current mocked UI action/data source to a real API contract. Record this in the phase branch/commit.
3. Work through phases strictly in order. Keep each phase independently runnable and testable.
4. Perform focused self-review and run relevant checks after every phase. The user will provide external Antigravity review only at high-risk gates: Phases 2, 4, 5, 6, 7, and 9. At those gates, prepare a concise evidence package and do not self-approve.
5. At every phase end: run the specified checks; update `RISK.md` with newly observed risks or changed status; update `PHASE_STATUS.md`; commit and push only after Codex’s checks pass. At high-risk gates (2, 4, 5, 6, 7, 9), stop before commit/push and wait for the user's external Antigravity Pass verdict. Do not push failed work or externally unreviewed high-risk work.
6. Keep development and runtime token use low: send only structured facts and minimal relevant code/context to an LLM; reuse cached immutable artifacts; never ask an LLM to calculate deterministic scores.

## Product scope

Build a React/TypeScript Figma frontend connected to a Python FastAPI backend. Use SQLite, SQLAlchemy (or a small documented repository layer), Pydantic, pandas, pytest, Bandit, Semgrep, and Docker-based isolated execution. The backend owns experiment data, audit logs, tool execution, metrics, reports, and model calls.

### Modes

| Mode | Purpose | Official aggregate statistics? |
|---|---|---|
| Benchmark Mode | Exactly 24 predefined, mixed-risk code-repair tasks with hidden ground truth and a pinned task manifest | Yes |
| Custom Prompt Mode | User-provided repair scenario/prompt, with controlled optional code context | No — exploratory only |
| Upload Existing Code Mode | User uploads a supported code archive/file for analysis and optional repair | No — exploratory only |

### Required workflow

1. Create a run, select one or all of the three fixed repair strategies, and freeze the run configuration.
2. Run the initial functional test suite and only the selected scan categories: injection, authentication/authorization, secrets, input validation, and dependency/configuration risk. A category may use Bandit, Semgrep, a deterministic rule adapter, or a documented combination; expose exactly which tools/rules ran.
3. For Benchmark Mode only, compare scanner findings internally against hidden ground truth. Never expose the hidden expected answer to a repair-model prompt or public client response.
4. Apply one of three fixed strategies: (A) vulnerability-specific repair, (B) scanner-feedback repair, (C) test-feedback repair. `Run All` executes each strategy from the identical immutable baseline in separate sandboxes.
5. Re-run functional tests and the same selected scans. Preserve tool logs, outcomes, diffs, prompt/model metadata, and container image digest.
6. Have an independent LLM reviewer assess the candidate patch using a strict structured response schema. It must not be the repair model call and must receive the minimal evidence necessary. Reviewer output advises acceptance/limitations; deterministic measurements remain the source of truth.
7. Calculate deterministic metrics and winner selection in Python: security effectiveness, functionality preservation, token count, cost, latency, and efficiency. Identify **best overall** and **best efficiency** using documented formulas and tie-breakers.
8. Send only a compact, validated result-facts object to a separate interpretation LLM. It returns strict structured natural-language interpretation. Validate it; display a safe template fallback if invalid. It explains results and never invents measurements.

## Official experiment controls

- Benchmark Mode uses only the exact 24-task dataset, task IDs, hidden-ground-truth package, scan policy version, Docker digest, tool versions/rules, strategy prompt versions, reviewer prompt version, model/provider/version/configuration, pricing table version, and metric version declared in the run manifest.
- Set temperature, max output, seed (if supported), context limits, retry policy, and provider identifiers in one immutable official model configuration. A configuration change creates a new experiment version; never mix versions in an aggregate.
- Pin dependencies and container images by version/digest. Record environment, source revision, timestamps, hashes, and a normalized evidence manifest for every run.
- Exploratory runs must be visibly labelled and hard-excluded at query/API level from official aggregation.

## Safety boundaries

- Treat uploaded code, generated patches, tests, and benchmark fixtures as untrusted. Execute only inside restricted, ephemeral Docker sandboxes: no network, non-root user, read-only baseline, limited CPU/RAM/PIDs/time/output, no host mounts or Docker socket, temporary per-run workspace, allowed-language policy, and cleanup/audit on completion.
- Never expose secrets, full untrusted uploads, hidden ground truth, raw provider credentials, or privileged host paths in browser responses or logs.
- Validate type, size, archive paths, encoding, and language before accepting uploads. Reject symlinks, path traversal, unsupported binaries, nested archive abuse, and excessive decompression.
- Do not claim a patch is secure merely because a scan passes. Report scan coverage and limitations.

## Required API/domain boundaries

Implement explicit Pydantic contracts for: task catalog; run creation/configuration; upload intake; selected scan policy; baseline assessment; strategy execution; artifact/log reference; reviewer result; deterministic metric record; interpretation facts/result; official aggregate; and run report. Use asynchronous job states (`queued`, `running`, `completed`, `failed`, `cancelled`) rather than browser-held pseudo-progress. The frontend polls or subscribes to real status and renders existing Figma screens from these contracts.

## LLM rules

- Use structured JSON-only responses validated with Pydantic for repair plans if used, reviewer outcomes, and final interpretation. Include `schema_version`, bounded enums, stable IDs, concise evidence references, and no Markdown fences.
- Build prompts from compact structured inputs. Cap prompt size, cap output tokens, redact secrets, deduplicate code/context, and reference stored artifacts by ID rather than repeating text.
- Record provider/model/request parameters, measured usage, cost calculation inputs, latency, retry count, prompt template version, and response-validation outcome.
- Deterministic Python calculates every metric, ranking, aggregate, and eligibility decision. LLMs provide patches/reviews/explanations only.

## Acceptance criteria

- All 24 benchmark tasks can run from a clean environment, results can be reproduced from manifests, and hidden ground truth cannot reach the repair/reviewer/interpreter public surfaces.
- Each strategy begins from identical baseline state; Run All has no cross-strategy contamination.
- Frontend retains Figma UI while showing real statuses, errors, evidence links, mode labels, strategy comparisons, and exploratory exclusions.
- Tests cover API contracts, task isolation, scanner selection, metric/ranking/ties, official/exploratory separation, structured LLM validation/fallback, and uploaded-code rejection paths.
- Codex test/self-review evidence is attached to every phase. External Antigravity evidence is attached before commit/push only for Phases 2, 4, 5, 6, 7, and 9.

Begin with Phase 0 only. Do not silently expand the scope. If a requirement conflicts with security, reproducibility, or the supplied Figma behavior, document it as a decision and request direction.
