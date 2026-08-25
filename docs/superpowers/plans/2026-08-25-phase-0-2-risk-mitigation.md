# Phase 0–2 Risk Mitigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mitigate every risk materially actionable through SecureEval Phase 2 with executable evidence, close Phase 2, and leave Phase 3 untouched.

**Architecture:** Harden the existing boundaries rather than introducing later-phase product features. The preserved React UI receives local fonts and canonical identifiers; FastAPI/SQLite gain fail-closed local deployment, recovery, retention, and audit controls; upload, patch, and Docker inputs receive independent bounded validators; native Linux CI reproduces the local evidence.

**Tech Stack:** React 19, TypeScript, Vite, FastAPI, Pydantic, SQLAlchemy, Alembic, SQLite, pytest, Docker, GitHub Actions, Node 22, pnpm 10.34.3, Python 3.14.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-0-2-risk-mitigation-design.md`

## Global Constraints

- Preserve the existing Figma layout, styling, navigation, and visual hierarchy; only approved fonts, taxonomy labels/IDs, and fixtures may change.
- Do not implement scanners, benchmark evaluation, repair execution, LLM roles, scoring, interpretation, or Phase 3 behavior.
- Use red/green TDD for every runtime behavior; record the failing and passing command output.
- Public errors, logs, receipts, manifests, and audit reason codes must not expose source, secrets, Docker output, or private host paths.
- Sandbox image remains `python@sha256:31da4cb527055e4e3d7e9e006dffe9329f84ebea79eaca0a1f1c27ce61e40ca5`.
- Upload limits remain 2 MiB transport, 100 files, 10 MiB expanded, 20:1 ratio, depth 8, and path length 240.
- Phase 3 may not start until the full completion gate passes and `PHASE_STATUS.md` closes Phase 2.

---

### Task 1: Self-contained Figma baseline and canonical taxonomy

**Files:**
- Create: `frontend/src/taxonomy.ts`
- Create: `frontend/src/taxonomy.contract-test.ts`
- Create: `frontend/src/assets/fonts/inter/Inter.ttf`
- Create: `frontend/src/assets/fonts/inter/OFL.txt`
- Create: `frontend/src/assets/fonts/roboto-condensed/RobotoCondensed.ttf`
- Create: `frontend/src/assets/fonts/roboto-condensed/OFL.txt`
- Create: `frontend/src/assets/fonts/jetbrains-mono/JetBrainsMono.ttf`
- Create: `frontend/src/assets/fonts/jetbrains-mono/OFL.txt`
- Create: `frontend/src/assets/fonts/SOURCES.json`
- Create: `docs/phase-2/figma-hardened-before.png`
- Create: `docs/phase-2/figma-hardened-after.png`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`
- Modify: `docs/phase-0/FIGMA_BASELINE_INVENTORY.md`
- Modify: `frontend/src/contracts/api-v1.ts`

**Interfaces:**
- Produces exact literal tuples `SCAN_CATEGORY_IDS` and `STRATEGY_IDS`, plus
  `SCAN_CATEGORIES: readonly ScanCategoryDefinition[]` and `STRATEGY_META`
  keyed only by those API identifiers.
- App consumes those exported identifiers; it must not define legacy `sql/path/cmd/deser/secret` or `generic/specific/scanner` IDs.

- [ ] **Step 1: Capture the pre-change render**

Run the existing production build and Edge headless screenshot procedure from Phase 0, saving the desktop result to `docs/phase-2/figma-hardened-before.png`. Record viewport, browser version, and SHA-256 beside the image in the baseline inventory.

- [ ] **Step 2: Write the failing taxonomy contract**

Create a compile-time contract with hand-derived literals:

```ts
import { SCAN_CATEGORY_IDS, STRATEGY_IDS } from "./taxonomy";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

const categoriesMatch: Equal<typeof SCAN_CATEGORY_IDS, readonly [
  "injection", "authentication_authorization", "secrets",
  "input_validation", "dependency_configuration",
]> = true;
const strategiesMatch: Equal<typeof STRATEGY_IDS, readonly [
  "vulnerability_specific_v1", "scanner_feedback_v1", "test_feedback_v1",
]> = true;
void categoriesMatch;
void strategiesMatch;
```

Also change `App.tsx` imports in the test branch so compilation fails while `taxonomy.ts` is absent and legacy IDs remain.

- [ ] **Step 3: Verify RED**

Run: `cd frontend; corepack pnpm exec tsc --noEmit`

Expected: FAIL because `./taxonomy` does not exist and App's legacy `StrategyId` values do not satisfy the API contract.

- [ ] **Step 4: Add canonical taxonomy and update fixtures**

Create `taxonomy.ts` with literal `as const satisfies` definitions. Mechanically replace App record keys, selections, fallback arrays, metadata, repaired-code fixtures, score fixtures, usage fixtures, and strategy-analysis fixtures with canonical IDs. Replace the five scan cards with the governing labels and descriptions. Do not alter component structure or class names.

- [ ] **Step 5: Vendor exact licensed fonts**

Resolve one immutable `google/fonts` commit with `git ls-remote`, download the variable TTF and OFL files for Inter, Roboto Condensed, and JetBrains Mono from that commit, compute SHA-256 values, and write commit/path/hash/license metadata to `SOURCES.json`. Replace the three remote imports with local `@font-face` declarations using the same family names and requested weight ranges. Abort if any license or hash is missing.

- [ ] **Step 6: Verify GREEN and visual preservation**

Run:

```powershell
cd frontend
corepack pnpm exec tsc --noEmit
corepack pnpm build
rg -n "fonts.googleapis.com|fonts.gstatic.com|'generic'|'specific'|'scanner'|id: 'sql'|id: 'path'|id: 'cmd'|id: 'deser'|id: 'secret'" src
```

Expected: type/build PASS and `rg` finds no runtime legacy/remote-font reference. Capture the same viewport to `figma-hardened-after.png`; review side-by-side for unchanged layout, spacing, colors, navigation, and typography appearance, with only approved copy differences.

- [ ] **Step 7: Commit**

```bash
git add frontend/src frontend/src/assets/fonts docs/phase-0/FIGMA_BASELINE_INVENTORY.md docs/phase-2/figma-hardened-*.png
git commit -m "fix: make Figma baseline reproducible"
```

### Task 2: SQLite concurrency and interrupted-run recovery

**Files:**
- Create: `backend/app/recovery.py`
- Create: `backend/tests/test_database_resilience.py`
- Modify: `backend/app/database.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services.py`
- Modify: `backend/tests/test_run_lifecycle.py`

**Interfaces:**
- Produces `recover_interrupted_runs(session: Session, *, now: datetime | None = None) -> tuple[str, ...]`.
- `create_database()` configures SQLite foreign keys, WAL, and a 5,000 ms busy timeout.
- Existing start/cancel transitions remain conditional and return the existing safe API errors.

- [ ] **Step 1: Write failing database/recovery tests**

Add real SQLite tests asserting `PRAGMA foreign_keys == 1`, `journal_mode == "wal"`, and `busy_timeout == 5000`. Add an integration test that persists one run in each state, recreates the app, and asserts only `running` becomes `failed` with `failure_code == "worker_interrupted"`, a bounded message, and updated timestamp. Add a concurrent start/cancel test that proves no stale writer overwrites a terminal state.

- [ ] **Step 2: Verify RED**

Run: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_database_resilience.py tests/test_run_lifecycle.py -q`

Expected: FAIL because PRAGMAs/recovery are absent and lifecycle writes are not all conditional.

- [ ] **Step 3: Implement minimal resilience controls**

Attach a SQLAlchemy `connect` event for SQLite PRAGMAs. Implement `recover_interrupted_runs` as one conditional SQL update over `status == "running"`, setting `failed`, `worker_interrupted`, the literal safe message `Run interrupted before completion.`, and the supplied timestamp. Invoke recovery once during lifespan startup. Convert remaining lifecycle read-then-write transitions to conditional `UPDATE ... WHERE status IN (...)` and reload the row after a successful claim.

- [ ] **Step 4: Verify GREEN**

Run the RED command, then `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_api.py tests/test_run_lifecycle.py tests/test_database_resilience.py -q`.

Expected: PASS; repeated recovery returns an empty tuple and terminal states remain unchanged.

- [ ] **Step 5: Commit**

```bash
git add backend/app/database.py backend/app/recovery.py backend/app/main.py backend/app/services.py backend/tests
git commit -m "fix: harden SQLite lifecycle recovery"
```

### Task 3: Stream-enforced hostile upload validation

**Files:**
- Modify: `backend/app/uploads/validation.py`
- Modify: `backend/app/uploads/policy.py`
- Modify: `backend/tests/test_upload_validation.py`

**Interfaces:**
- Produces `_read_zip_member(archive, item, policy, consumed_bytes) -> bytes` that reads at most 64 KiB per call and raises `UploadRejected` before actual aggregate bytes exceed policy.
- `validate_source()` remains the public interface and returns the same canonical `ValidatedSource`.

- [ ] **Step 1: Write failing actual-byte and metadata-mutation tests**

Add cases where central-directory sizes/offsets are mutated, compression metadata disagrees with content, Unicode/casefold paths collide, Unix hardlink-like mode metadata appears, and a chunked member crosses the actual aggregate limit. Each test must assert a safe reason code and no filesystem writes.

- [ ] **Step 2: Verify RED**

Run: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_upload_validation.py -q`

Expected: at least the actual-byte/mutated-metadata cases fail against `archive.read(item)`.

- [ ] **Step 3: Implement bounded member reads**

Read each `ZipExtFile` in 64 KiB chunks into an in-memory buffer, incrementing actual aggregate bytes before appending. Reject when actual bytes exceed 10 MiB or actual/compressed bytes exceed 20:1. Convert `BadZipFile`, CRC/overlap/runtime decompression errors, unsupported compression, and inconsistent declared/actual sizes into bounded `invalid_archive`, `expanded_too_large`, or `expansion_ratio_exceeded` reasons. Preserve canonical sorting/hashing.

- [ ] **Step 4: Verify GREEN**

Run the RED command and `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_upload_api.py tests/test_artifact_store.py -q`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/uploads backend/tests/test_upload_validation.py
git commit -m "fix: enforce actual archive expansion limits"
```

### Task 4: Automatic retention cleanup and deletion audit

**Files:**
- Create: `backend/app/uploads/retention.py`
- Create: `backend/migrations/versions/0003_phase2_hardening.py`
- Create: `backend/tests/test_upload_retention.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/services.py`
- Modify: `backend/tests/test_migrations.py`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces `cleanup_expired_artifacts(session_factory, store, *, now=None) -> CleanupReport`.
- Produces `run_retention_loop(session_factory, store, stop_event, interval_seconds) -> None`.
- Migration adds composite index `ix_upload_artifacts_state_expires_at`; existing `state` and `deleted_at` columns carry the lifecycle.

- [ ] **Step 1: Write failing cleanup lifecycle tests**

Test available/expired → deleting → deleted, filesystem removal, `deleted_at`, one `artifact_deleted` audit event, absent-directory idempotence, retry after a synthetic filesystem failure, startup recovery from `deleting`, concurrent cleanup claims, and rejection of binding while deleting/deleted. Use real temporary directories and SQLite; fake only the one failing deletion operation.

- [ ] **Step 2: Verify RED**

Run: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_upload_retention.py tests/test_run_source_binding.py -q`

Expected: FAIL because the retention service, state claims, and lifespan task do not exist.

- [ ] **Step 3: Implement the idempotent cleanup service**

Select eligible IDs, conditionally claim one row at a time, delete only through `ArtifactStore.delete(upload_id)`, and finalize metadata/audit in a fresh transaction. Leave failed rows in `deleting` and append `artifact_delete_failed` with a fixed reason code. Resume `deleting` on the next run. Add the lifespan task with a production minimum interval of 60 seconds and test injection for shorter intervals; signal and await it during shutdown.

- [ ] **Step 4: Verify migration and GREEN**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_upload_retention.py tests/test_run_source_binding.py tests/test_migrations.py -q
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Expected: PASS and migration head `0003_phase2_hardening`.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/migrations backend/tests backend/.env.example
git commit -m "feat: enforce upload retention cleanup"
```

### Task 5: Local-only access and deterministic output redaction

**Files:**
- Create: `backend/app/redaction.py`
- Create: `backend/tests/test_redaction.py`
- Create: `backend/tests/test_local_access.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/sandbox/executor.py`
- Modify: `backend/app/sandbox/policy.py`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

**Interfaces:**
- Produces `redact_text(value: str, *, secret_values=(), private_roots=()) -> RedactionResult` with `text` and `redacted`.
- `create_app(..., enforce_loopback: bool = True)` rejects non-loopback client/Host inputs before route handling; tests explicitly pass `False` only where TestClient transport cannot present a real loopback socket.
- `ExecutionResult` adds `output_redacted: bool`.

- [ ] **Step 1: Write failing redaction and access tests**

Use synthetic GitHub/OpenAI/AWS tokens, PEM blocks, Windows/POSIX paths, configured secret values, artifact roots, and split stdout/stderr cases. Assert the matched value never appears and `[REDACTED]` does. Add ASGI integration cases for allowed `127.0.0.1`, `::1`, and `localhost`, and rejected remote client/Host plus ignored forwarding headers.

- [ ] **Step 2: Verify RED**

Run: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_redaction.py tests/test_local_access.py -q`

Expected: FAIL because redaction and the loopback boundary do not exist.

- [ ] **Step 3: Implement redaction and fail-closed local access**

Implement longest-secret-first literal replacement plus bounded regexes for the documented credential/key/path classes. Apply it after byte bounding and UTF-8 replacement but before constructing `ExecutionResult`. Add middleware using `ipaddress.ip_address`, strict local Host parsing, and no trust in `X-Forwarded-*`. Allow `/api/v1/health` only through the same boundary.

- [ ] **Step 4: Verify GREEN**

Run the RED command plus `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_upload_api.py tests/test_api.py -q`.

- [ ] **Step 5: Commit**

```bash
git add backend/app backend/tests docs/LOCAL_DEVELOPMENT.md
git commit -m "fix: enforce local access and redact output"
```

### Task 6: Sandbox staging, isolation, and concurrency hardening

**Files:**
- Create: `backend/app/sandbox/source_tree.py`
- Create: `backend/app/sandbox/capacity.py`
- Create: `backend/tests/test_sandbox_source_tree.py`
- Modify: `backend/app/sandbox/executor.py`
- Modify: `backend/app/sandbox/policy.py`
- Modify: `backend/config/sandbox-policy-v1.json`
- Modify: `backend/tests/test_sandbox_policy.py`
- Modify: `backend/tests/test_sandbox_live.py`

**Interfaces:**
- Produces `validate_source_tree(path: Path, policy: UploadPolicy) -> ValidatedTree` without following links.
- Produces process-shared `ExecutionCapacity(limit=2)` with fail-fast `acquire()` and guaranteed release.
- Raises safe `SandboxBusy` and `SourceTreeRejected(reason)` exceptions.

- [ ] **Step 1: Write failing source-tree/capacity/policy tests**

Add real filesystem cases for symlinks, Windows reparse attributes where supported, special files where supported, unsupported extensions, file count/byte excess, containment, and a valid nested tree. Add two held capacity slots and prove the third execution fails immediately and a slot returns after every exception. Assert Docker arguments/evidence include `--ipc none` and `--ulimit nofile=256:256` while retaining all existing controls.

- [ ] **Step 2: Verify RED**

Run: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_sandbox_source_tree.py tests/test_sandbox_policy.py -q`

Expected: FAIL because unsafe direct executor trees are followed and no shared capacity/isolation flags exist.

- [ ] **Step 3: Implement validation and capacity**

Walk with `os.scandir`/`lstat`, reject link/reparse/special entries before reads, and return sorted immutable file descriptors with actual totals. Build the tar only from that validated descriptor list. Acquire the shared capacity before creating staging and release in the outermost `finally`. Add IPC/open-file flags and sanitized evidence fields.

- [ ] **Step 4: Extend live adversarial evidence**

Add live profiles proving arbitrary host secret environment variables are absent, open-file/PID limits block growth, no network route exists, source/root remain read-only, capacity refusal creates no container, and success/failure/timeout/cancel still remove exact containers/staging.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests/test_sandbox_source_tree.py tests/test_sandbox_policy.py -q
.\.venv\Scripts\python.exe -m pytest -m docker_live -q
docker ps -a --filter label=secureeval.execution_id --quiet
```

Expected: all tests PASS and the final Docker query is empty.

- [ ] **Step 6: Commit**

```bash
git add backend/app/sandbox backend/config backend/tests
git commit -m "fix: harden sandbox staging and capacity"
```

### Task 7: Non-executing generated-diff validator

**Files:**
- Create: `backend/app/patches/__init__.py`
- Create: `backend/app/patches/validation.py`
- Create: `backend/tests/test_patch_validation.py`

**Interfaces:**
- Produces `validate_unified_diff(payload: bytes, allowed_paths: frozenset[str], policy: PatchPolicy = PatchPolicy()) -> ValidatedPatch`.
- `PatchPolicy` caps transport bytes, changed files, and added/deleted line bytes.
- `ValidatedPatch` contains canonical changed paths and counts only; it never applies a patch.

- [ ] **Step 1: Write failing patch-boundary tests**

Use hand-authored unified diffs for one valid source edit and rejections covering absolute/traversal/drive/UNC/ADS paths, unknown paths, binary markers, `GIT binary patch`, symlink/special modes, rename/copy headers, unsupported extensions, malformed hunks, duplicate paths, invalid UTF-8, NUL, excessive files, excessive transport, and excessive changed bytes.

- [ ] **Step 2: Verify RED**

Run: `cd backend; .\.venv\Scripts\python.exe -m pytest tests/test_patch_validation.py -q`

Expected: import failure because `app.patches.validation` does not exist.

- [ ] **Step 3: Implement a strict parser**

Parse only `diff --git`, `---`, `+++`, and unified hunk forms required by the valid fixture. Normalize both `a/` and `b/` paths through the upload path normalizer, require equality with `allowed_paths`, reject all unsupported metadata before returning an immutable canonical result, and perform no subprocess/filesystem mutation.

- [ ] **Step 4: Verify GREEN**

Run the RED command and `cd backend; .\.venv\Scripts\python.exe -m compileall -q app tests`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/patches backend/tests/test_patch_validation.py
git commit -m "feat: validate generated diffs safely"
```

### Task 8: Platform locks, immutable CI, and current audits

**Files:**
- Create: `backend/pylock.linux.toml`
- Create: `.github/workflows/phase2-hardening.yml`
- Create: `docs/phase-2/SUPPLY_CHAIN_EVIDENCE.md`
- Modify: `backend/README.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`
- Modify: `frontend/package.json` only to add exact `packageManager: "pnpm@10.34.3"` and `engines.node: "22.x"`.

**Interfaces:**
- Windows installation consumes `backend/pylock.toml`; Ubuntu x86_64 consumes `backend/pylock.linux.toml`.
- CI has `permissions: contents: read`, no persisted checkout credentials, no repository write token, and only full-SHA action references.

- [ ] **Step 1: Prove the existing Linux gap**

Run the Windows lock dry-run in a native `python:3.14.2-slim` Linux container and record the expected platform-resolution failure. Run the current workflow inventory and confirm no native Linux verification exists.

- [ ] **Step 2: Generate and verify the Linux lock**

Resolve and record the exact digest for `python:3.14.2-slim`. In that container, install the same exact pip version used locally and run `python -m pip lock` from the explicit dependency list in `pyproject.toml` plus test dependencies, outputting `pylock.linux.toml`. Re-run `pip install --dry-run --ignore-installed -r pylock.linux.toml` inside the same digest and abort on any unhashed or unresolved package.

- [ ] **Step 3: Resolve immutable CI dependencies**

Use `git ls-remote` against the official `actions/checkout`, `actions/setup-node`, and `actions/setup-python` release tags, record each full commit SHA in the workflow comment, and reference only that SHA. Configure Node `22`, Corepack `pnpm@10.34.3`, Python `3.14`, and Docker. Do not use floating tags.

- [ ] **Step 4: Add native Linux verification**

Workflow steps: checkout without persisted credentials; install exact frontend
lock; typecheck/build; install backend from Linux lock; compile; run full pytest
including Docker live tests; verify no labeled containers; run secret/private-
path scan; run `pnpm audit --audit-level high`; run `pip-audit==2.10.1` installed
from a hash-pinned audit-tools lock; scan the pinned sandbox digest with Trivy
`0.73.0` using its resolved immutable container digest and fail on fixable
HIGH/CRITICAL findings. Record tool versions, commands, results, and every
non-fixable advisory in `SUPPLY_CHAIN_EVIDENCE.md`.

- [ ] **Step 5: Verify locally**

Run YAML parsing, frontend package-manager enforcement, Windows lock dry-run, Linux-container lock dry-run, and `git diff --check`. Push the branch and require the `phase2-hardening` workflow to pass; a missing/blocked CI result is not evidence.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/phase2-hardening.yml backend/pylock.linux.toml backend/README.md docs/LOCAL_DEVELOPMENT.md docs/phase-2/SUPPLY_CHAIN_EVIDENCE.md frontend/package.json
git commit -m "ci: verify Phase 2 on pinned Linux toolchain"
```

### Task 9: Governing-document repair and final risk closure

**Files:**
- Modify: `MASTER_CODEX_PROMPT.md`
- Modify: `TESTING_AND_QA.md`
- Modify: `RISK.md`
- Modify: `PHASE_STATUS.md`
- Modify: `docs/phase-2/ANTIGRAVITY_HANDOFF.md`
- Create: `docs/phase-2/RISK_MITIGATION_EVIDENCE.md`

**Interfaces:**
- Evidence maps every covered risk to control, test/command, result, commit, residual condition, and later-phase reopen trigger.
- Phase 2 closes only after the pushed CI and final security scan pass.

- [ ] **Step 1: Correct governing inconsistencies**

Replace the current-document `SECURITY.md` instruction with `SECURITY_DESIGN.md` and release-gate `Phase 10` references with `Phase 9`. Do not alter quoted historical evidence; label unavoidable historical strings explicitly.

- [ ] **Step 2: Run fresh full verification**

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing
.\.venv\Scripts\python.exe -m compileall -q app migrations tests
.\.venv\Scripts\python.exe -m pip install --dry-run --ignore-installed -r pylock.toml
cd ..\frontend
corepack pnpm exec tsc --noEmit
corepack pnpm build
cd ..
git diff --check
docker ps -a --filter label=secureeval.execution_id --quiet
```

Expected: all commands PASS; no leaked container IDs.

- [ ] **Step 3: Run final security and hygiene reviews**

Run a new Codex Security working-tree diff scan from commit `cb93a4e`, review every changed security surface, validate all candidates, and complete the scan. Run secret, private-path, archive, lock/digest, and Figma runtime evidence checks. Record the scan ID and sealed finding/coverage counts.

- [ ] **Step 4: Update risks truthfully**

For R-01–R-09, R-27, R-28, R-31, R-32, and R-35–R-41, record `Mitigated` only where the specified control and evidence passed. Each recurring risk entry must name the later phase or deployment condition that reopens it. Any failed, unavailable, or externally unverifiable control remains `Blocked` and prevents Phase 2 closure.

- [ ] **Step 5: Close Phase 2 and push**

Update `PHASE_STATUS.md` with full commit SHAs, self-review/security/CI evidence, the user-waived external gate, actual PR state, and `Complete (closed)`. Commit and push:

```bash
git add MASTER_CODEX_PROMPT.md TESTING_AND_QA.md RISK.md PHASE_STATUS.md docs/phase-2
git commit -m "docs: close hardened Phase 2"
git push
```

- [ ] **Step 6: Verify remote synchronization before Phase 3**

Run `git status --short` (empty) and `git rev-list --left-right --count '@{u}...HEAD'` (expected `0 0`). Only then create the Phase 3 branch/worktree from the hardened Phase 2 head and begin Phase 3 planning.
