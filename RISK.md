# Internal Risk Register

**Purpose:** record potential risks for a separate future risk-mitigation agent. This register intentionally does not assign mitigations to the implementation agent. Default mitigation owner: **Future risk-mitigation agent**. Update discovery/status/evidence after every phase.

| ID | Phase(s) | Risk | Impact | Likelihood | Status | Evidence / trigger | Mitigation owner |
|---|---|---|---|---|---|---|---|
| R-01 | 0 | Supplied Figma export/assets are incomplete or imports missing | UI regression/block | M | Observed | Export has no local fonts or visual reference screenshots; Google Fonts are remote | Future risk-mitigation agent |
| R-02 | 0–9 | Figma UI changed while wiring real behavior | Product/design regression | M | Open | Visual review diff | Future risk-mitigation agent |
| R-03 | 1–9 | Frontend trusts client-held status/metrics | Tampering/incorrect reporting | M | Open | Contract review | Future risk-mitigation agent |
| R-04 | 1–9 | SQLite concurrency/job recovery limitations | Lost/stuck experiments | M | Open | Load/failure test | Future risk-mitigation agent |
| R-05 | 2–9 | Untrusted code escapes or abuses Docker sandbox | Host compromise | M | Open | Sandbox review | Future risk-mitigation agent |
| R-06 | 2–9 | Sandbox network egress or secret access | Data exfiltration | M | Open | Egress test/config audit | Future risk-mitigation agent |
| R-07 | 2–9 | CPU/RAM/PID/time/log exhaustion | Denial of service/cost | H | Open | Adversarial workload | Future risk-mitigation agent |
| R-08 | 2–9 | Archive traversal, symlink, decompression or binary abuse | Host/data compromise | H | Open | Upload fuzzing | Future risk-mitigation agent |
| R-09 | 2–9 | Unsafe generated diff changes files outside scope | Integrity breach | M | Open | Patch validation test | Future risk-mitigation agent |
| R-10 | 3–9 | Selective scan coverage is misrepresented | Invalid security claim | M | Open | Report/UI audit | Future risk-mitigation agent |
| R-11 | 3–9 | Bandit/Semgrep results drift by version/rule/config | Non-comparable results | H | Open | Manifest mismatch | Future risk-mitigation agent |
| R-12 | 3–9 | Finding normalization/deduplication is unstable | Incorrect metrics | M | Open | Determinism test | Future risk-mitigation agent |
| R-13 | 4–10 | Hidden truth/tests leak to UI, prompts, logs, or repo | Benchmark invalidation | H | Open | Boundary audit | Future risk-mitigation agent |
| R-14 | 4–10 | Repair strategies receive unequal baseline/context | Biased comparison | H | Open | Artifact/prompt diff | Future risk-mitigation agent |
| R-15 | 4–10 | Benchmark tasks are unrepresentative or mislabeled | Research validity risk | M | Open | Corpus review | Future risk-mitigation agent |
| R-16 | 5–10 | Tests/scans pass but fix is incomplete | False confidence | H | Open | Reviewer/evaluator discrepancy | Future risk-mitigation agent |
| R-17 | 5–10 | Metric formula/weights bias winner | Invalid research conclusion | M | Open | Metric review | Future risk-mitigation agent |
| R-18 | 5–10 | Exploratory modes contaminate official aggregates | Invalid benchmark statistics | H | Open | Aggregate predicate test | Future risk-mitigation agent |
| R-19 | 5–10 | Tie-breakers/pricing/latency measurements are inconsistent | Unfair ranking | M | Open | Replay mismatch | Future risk-mitigation agent |
| R-20 | 6–10 | Model alias/version/config changes silently | Non-reproducible experiments | H | Open | Manifest audit | Future risk-mitigation agent |
| R-21 | 6–10 | Provider token/cost data is absent/inaccurate | Cost metric error | M | Open | Gateway reconciliation | Future risk-mitigation agent |
| R-22 | 6–10 | Prompt injection through code/comments manipulates model | Unsafe/invalid model output | M | Open | Prompt robustness test | Future risk-mitigation agent |
| R-23 | 6–10 | Large prompts or retry loops inflate cost/latency | Operational budget failure | H | Open | Usage threshold breach | Future risk-mitigation agent |
| R-24 | 6–10 | Invalid structured model output is accepted as prose | Corrupt reports/automation | M | Open | Schema test | Future risk-mitigation agent |
| R-25 | 6–10 | Reviewer is not actually independent/blinded | Biased review | M | Open | Prompt/audit review | Future risk-mitigation agent |
| R-26 | 7–10 | Natural-language interpretation invents facts | Misleading result report | M | Open | Fact-citation validation | Future risk-mitigation agent |
| R-27 | 7–10 | Logs/artifacts expose source, secrets, or paths | Privacy/security breach | H | Open | Redaction test | Future risk-mitigation agent |
| R-28 | 7–10 | Authentication/authorization absent or weak | Unauthorized run/artifact access | H | Open | Access-control test | Future risk-mitigation agent |
| R-29 | 8–10 | Browser reports stale/cancelled state as completed | User decision error | M | Open | E2E lifecycle test | Future risk-mitigation agent |
| R-30 | 8–10 | Accessibility/responsive state regresses | Usability/accessibility failure | M | Open | UI audit | Future risk-mitigation agent |
| R-31 | 9–10 | Dependencies/container supply chain compromised | Security/reproducibility risk | M | Open | Lock/digest audit | Future risk-mitigation agent |
| R-32 | 9–10 | Retention/deletion policy conflicts with research evidence | Privacy/compliance risk | M | Open | Policy review | Future risk-mitigation agent |
| R-33 | 10 | QA agent self-reviews or evidence is superficial | Defects released | M | Open | Assignment/evidence audit | Future risk-mitigation agent |
| R-34 | 10 | Remote push unavailable/unauthorized | Delivery incomplete | M | Open | Push result | Future risk-mitigation agent |
| R-35 | 0–7 | Figma scan and strategy taxonomies conflict with governing contracts | Invalid experiment configuration or misleading UI | H | Observed | Figma has SQL/path/command/deserialization/secret categories and generic/specific/scanner strategies; specs define different fixed IDs | Future risk-mitigation agent |
| R-36 | 0–9 | Governing documents disagree on security filename and final phase number | Process drift or skipped/misapplied gate | M | Observed | `MASTER_CODEX_PROMPT.md` names `SECURITY.md`; package has `SECURITY_DESIGN.md`; `TESTING_AND_QA.md` and risk rows mention Phase 10 while plan/status end at Phase 9 | Future risk-mitigation agent |
| R-37 | 0–8 | Verification runs with tool versions different from the Figma `.mise.toml` pins | Build/replay drift between environments | M | Observed | Phase 0 used Node 24.11.0 and pnpm 11.23.0; export declares Node 22 and pnpm 10.34.3 | Future risk-mitigation agent |

| R-38 | 1-9 | Platform-specific backend lock is reused on an incompatible runtime | Non-reproducible or failed install | M | Observed | PEP 751 lock is Python 3.14/Windows-specific | Future risk-mitigation agent |
| R-39 | 1–2 | Automated security diff workbench may be blocked by host application control | Reduced automated security review evidence | L | Observed | Phase 1 was blocked; Phase 2 scan `153fd200-61c2-4b23-90ab-0ca3024da7fd` completed with 20 files and no findings | Future risk-mitigation agent |
| R-40 | 2–9 | Local Docker daemon trust or Docker Desktop behavior differs from the production Linux host | Host compromise or invalid isolation evidence | M | Open | Cross-host sandbox review and production deployment validation | Future risk-mitigation agent |
| R-41 | 2–9 | Expired upload metadata/files are not yet removed by an automatic scheduler | Retention overrun/privacy exposure | M | Open | `delete_expired` exists but no Phase 2 background cleanup scheduler invokes it | Future risk-mitigation agent |
## Update rule

For each phase, append a dated note beneath the table: changed IDs, observed evidence, status (`Open`, `Observed`, `Accepted`, `Mitigated`, `Blocked`), and any newly discovered risk. Do not delete historical entries.

## 2026-08-25 — Phase 0

- **R-01 — Observed:** all 30 export files were inventoried and the archive hash
  was recorded. No local visual assets or fonts are missing by reference, but
  the runtime depends on three remote Google Fonts and the export supplies no
  screenshot/golden baseline.
- **R-02 — Open:** the Figma runtime source hashes match the supplied archive,
  the production build and headless render smoke passed, and no visual source
  was edited. Risk remains open for later data-plumbing phases.
- **R-35 — Observed (new):** scan-category and strategy IDs/copy do not match
  the governing contracts. The exact differences and API ownership are recorded
  in `docs/phase-0/FIGMA_BASELINE_INVENTORY.md`.
- **R-36 — Observed (new):** planning-file and phase-number inconsistencies are
  documented. Phase execution continues to follow `IMPLEMENTATION_PLAN.md` and
  `PHASE_STATUS.md`, which define Phases 0–9.
- **R-37 — Observed (new):** frozen-lockfile verification succeeded with the
  locally available Node 24.11.0/pnpm 11.23.0 rather than the export's declared
  Node 22/pnpm 10.34.3 toolchain.

## 2026-08-25 - Phase 1

- **R-03 - Observed:** strict Pydantic creation models reject client-owned status,
  metrics, and eligibility fields; the typed client consumes server status. Risk
  remains open until the preserved UI is wired in Phase 7.
- **R-04 - Open:** SQLite persistence and queued/running/cancelled transitions
  are integration-tested, but concurrent conditional updates and worker crash
  recovery remain later-phase work.
- **R-28 - Open:** Phase 1 is a local-first API with narrow CORS origins but no
  authentication. It must remain locally bound until authorization is added
  before any multi-user or remote deployment.
- **R-31 - Observed:** the backend now has a complete hashed PEP 751 lock and the
  existing frontend lock remains frozen; container digest review remains later.
- **R-38 - Observed (new):** `backend/pylock.toml` is intentionally scoped to
  Python 3.14 on Windows. Another runtime/platform requires a separately
  reviewed regenerated lock rather than silent dependency resolution.
- **R-39 - Blocked (new tooling evidence):** the optional Codex Security diff
  workbench could not start because Windows Application Control blocked its
  bundled `_sqlite3` DLL. Phase 1 used an independent API reviewer plus direct
  security/contract tests; the required external security gate begins at Phase 2.

## 2026-08-25 — Phase 2 self-review closeout

- **R-05/R-06 — Observed:** live Docker evidence proves the pinned container is
  non-root, has zero effective capabilities, no non-loopback route, no mounts,
  a read-only root/source, and is cleaned after execution. These risks remain
  open pending independent review and production-host validation.
- **R-07 — Observed:** CPU, RAM, PID, wall-time, retained-output, and tmpfs
  limits are policy-tested; live failure, timeout, output truncation,
  cancellation, and cleanup passed. Host/Docker-daemon exhaustion remains open.
- **R-08 — Observed:** the hostile-input suite rejects traversal, absolute/UNC/
  drive paths, NTFS ADS/reserved names, symlinks, special/encrypted/nested or
  invalid archives, duplicate paths, binary/invalid UTF-8, and all configured
  count/size/depth/ratio limits.
- **R-09 — Open:** generated patch validation belongs to Phase 5 and was not
  implemented in Phase 2.
- **R-27/R-28 — Open:** receipts, manifests, errors, and sandbox evidence are
  bounded/redacted, but source confidentiality and authorization remain risks;
  Phase 2 is explicitly local-only and has no authentication.
- **R-31/R-38 — Observed:** the Docker image is pinned by exact digest and the
  Python 3.14/Windows lock dry-run passed; production-platform lock/image review
  remains required.
- **R-32/R-41 — Open:** artifacts are marked with a 24-hour exploratory expiry,
  expired uploads cannot bind, and scoped deletion exists; automatic deletion
  scheduling and deletion audit integration are not yet implemented.
- **R-39 — Observed:** the Phase 2 Codex Security working-tree scan completed
  successfully (`153fd200-61c2-4b23-90ab-0ca3024da7fd`), covering 20 changed
  application/dependency files with six reviewed surfaces and no findings.
- **R-40 — Open (new):** current live evidence comes from Docker Desktop's
  Linux engine; the daemon is trusted infrastructure and production Linux-host
  equivalence has not yet been independently validated.
- **Review-gate exception:** the user explicitly waived the independent
  Antigravity review for Phase 2 on 2026-08-25. Codex self-review, the completed
  Codex Security scan, and all listed automated/live checks are the closeout
  evidence; this does not represent an independent external verdict.