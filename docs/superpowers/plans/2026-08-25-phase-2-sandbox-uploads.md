# Phase 2 Sandbox and Upload Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add validated exploratory source intake and a live, digest-pinned,
resource-bounded Docker execution foundation without changing the Figma UI.

**Architecture:** FastAPI streams multipart input into a policy-driven validator
that normalizes accepted source into a private immutable artifact store and
persists only opaque metadata. A Docker CLI adapter runs backend-owned command
profiles with an auditable policy, bounded output, cooperative cancellation,
and unconditional container/workspace cleanup.

**Tech Stack:** Python 3.14, FastAPI, Pydantic, SQLAlchemy, Alembic, pytest,
standard-library ZIP/subprocess/filesystem modules, Docker Engine/CLI, React
TypeScript compile contracts.

**Spec:** `docs/superpowers/specs/2026-08-25-phase-2-sandbox-uploads-design.md`

## Global Constraints

- Repository-root planning documents govern this plan.
- Preserve `frontend/src/App.tsx`, `frontend/src/index.css`,
  `frontend/src/main.tsx`, and `frontend/vite.config.ts` byte-for-byte.
- Accept only the source types and exact limits in the Phase 2 design.
- Never expose source bytes, filenames from rejected input, private paths,
  Docker container IDs, or unrestricted logs through public schemas.
- Docker image references require `@sha256:<64 lowercase hex>`.
- No host mounts, Docker socket, network, root UID, capabilities, privileged
  mode, or unbounded resources/output are permitted.
- Every production behavior begins with a test that is observed failing for the
  intended missing behavior.
- Do not commit, push, or start Phase 3 before external Antigravity Pass.

---

### Task 1: Upload policy and hostile-input validator

**Files:**
- Create: `backend/app/uploads/__init__.py`
- Create: `backend/app/uploads/policy.py`
- Create: `backend/app/uploads/validation.py`
- Create: `backend/tests/test_upload_validation.py`

**Interfaces:**
- Produces: `UploadPolicy`, `UploadRejected`, `ValidatedSource`, and
  `validate_source(filename: str, payload: bytes, policy: UploadPolicy) -> ValidatedSource`.
- `ValidatedSource.files` is a tuple of immutable `(relative_path, bytes)`
  values sorted by normalized POSIX path; `manifest_json` and `content_hash`
  are canonical and deterministic.

- [ ] **Step 1: Write failing valid-input tests**

  Add literal expectations for one UTF-8 `.py` file and a hand-built ZIP with
  two out-of-order files. Assert sorted paths, exact byte totals, stable
  canonical manifest JSON, and a hand-computed SHA-256 string. The production
  mutation caught is accepting unsorted/non-canonical content or hashing the
  transport ZIP instead of normalized source.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `.\.venv\Scripts\python.exe -m pytest tests/test_upload_validation.py -q`

  Expected: collection fails because `app.uploads.validation` does not exist.

- [ ] **Step 3: Implement the minimal valid-input path**

  Define a frozen policy with the approved extensions and limits. Normalize
  paths with `PurePosixPath`, decode content as strict UTF-8, reject NUL/control
  bytes, sort files, emit canonical JSON using `sort_keys=True` and compact
  separators, and hash the exact UTF-8 manifest bytes.

- [ ] **Step 4: Run the focused tests and verify GREEN**

  Run the command from Step 2 and require all valid-input tests to pass.

- [ ] **Step 5: Add hostile-path and archive RED tests**

  Parameterize literal fixtures for `/absolute.py`, `C:\\drive.py`, UNC paths,
  `../escape.py`, backslash traversal, dot segments, excessive depth/name
  length, duplicate normalized/case-folded names, ZIP symlink mode, encrypted
  flag, directory/special mode, nested `.zip`/`.tar` names, invalid ZIP, and
  unsupported extensions. Assert only stable internal reason enums, never
  echoed rejected names.

- [ ] **Step 6: Implement archive metadata rejection and verify GREEN**

  Inspect every `ZipInfo` before reading an entry. Reject encrypted flags,
  symlink/special Unix modes, duplicates, unsafe normalized paths, and nested
  archive suffixes. Only after the complete metadata pass may content be read.

- [ ] **Step 7: Add size/count/ratio/encoding RED tests**

  Cover empty input, request over 2 MiB, more than 100 files, more than 10 MiB
  expanded bytes, aggregate ratio over 20:1, invalid UTF-8, NUL/control bytes,
  and binary-looking payloads. Each limit fixture uses a reduced policy so the
  test remains fast while exercising the real branch.

- [ ] **Step 8: Implement bounded content checks and run the validator suite**

  Read each accepted ZIP entry through a bounded loop, enforce cumulative
  bytes during reading, and reject mismatched/truncated data. Require the full
  validator suite to pass.

### Task 2: Private artifact store, persistence, audit, and upload API

**Files:**
- Create: `backend/app/uploads/store.py`
- Create: `backend/app/uploads/service.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py`
- Create: `backend/migrations/versions/0002_phase2_artifacts.py`
- Modify: `backend/pyproject.toml`
- Modify: `backend/pylock.toml`
- Create: `backend/tests/test_upload_api.py`
- Create: `backend/tests/test_artifact_store.py`
- Modify: `backend/tests/test_migrations.py`
- Modify: `backend/tests/conftest.py`

**Interfaces:**
- Produces: `ArtifactStore.store(validated, purpose) -> StoredArtifact`,
  `delete(upload_id)`, `delete_expired(now)`, and `POST /api/v1/uploads`.
- Public response: `UploadReceipt(schema_version, upload_id, purpose,
  file_count, total_bytes, content_hash, retention_class, created_at,
  expires_at)`.
- Database entities: `UploadArtifactRecord` and `AuditEventRecord`; private
  storage uses only an opaque relative key.

- [ ] **Step 1: Write failing artifact-store behavior tests**

  Assert atomic creation under `upload_<32 hex>`, read-only normalized files,
  absence of transport ZIP, no path outside the configured root, cleanup on a
  forced write failure, idempotent deletion, and expiry deletion. The mutation
  caught is any partial/predictable/path-controlled storage operation.

- [ ] **Step 2: Verify RED and implement the minimal store**

  Run the artifact-store file, confirm the missing module failure, then
  implement a same-root temporary directory, exclusive destination creation,
  safe relative joins, restrictive permissions, atomic rename, and guarded
  recursive deletion limited to verified opaque child directories.

- [ ] **Step 3: Write failing migration tests**

  Assert upload metadata columns/indexes and audit-event columns exist after
  upgrade, with unique opaque IDs, content hash, purpose, retention, expiry,
  state, and no full filesystem-path column.

- [ ] **Step 4: Implement models and migration, then verify GREEN**

  Add `UploadArtifactRecord` and `AuditEventRecord`; implement Alembic revision
  `0002_phase2_artifacts` with `down_revision = "0001_phase1_foundation"`.

- [ ] **Step 5: Write failing multipart API tests**

  Test valid single-file and ZIP receipts, request streaming limit,
  `upload_rejected` safe envelope, unknown purpose validation, no returned raw
  source/path, database audit reason code, and staging cleanup after rejection.

- [ ] **Step 6: Add multipart dependency through the locked workflow**

  Add an exact `python-multipart` version to `pyproject.toml`; regenerate the
  Python 3.14/Windows `pylock.toml` with hashes; run
  `pip install --dry-run --ignore-installed -r pylock.toml`; then install the
  exact package into the existing Phase 2 virtual environment.

- [ ] **Step 7: Implement the streaming endpoint and service transaction**

  Read `UploadFile` in 64 KiB chunks up to `max_upload_bytes + 1`, validate,
  store, insert metadata/audit, and commit. If persistence fails, delete the
  stored artifact. Map every `UploadRejected` to the generic public message
  while persisting only the stable reason code.

- [ ] **Step 8: Run upload API, migration, and Phase 1 regression tests**

  Require the focused suites and the existing 16 tests to pass.

### Task 3: Exploratory run binding and immutable manifest provenance

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/services.py`
- Modify: `backend/app/manifests.py`
- Modify: `backend/app/models.py`
- Create: `backend/tests/test_run_source_binding.py`
- Modify: `backend/tests/test_manifest.py`
- Modify: `frontend/src/contracts/api-v1.ts`
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/api/upload-response.contract-test.ts`

**Interfaces:**
- `RunCreate.upload_id: str | None` retains the authoritative API field name.
- Custom Prompt permits prompt plus optional `upload_id` with purpose
  `custom_prompt_context`; Upload Mode requires purpose `uploaded_code`;
  Benchmark rejects source references.
- `canonical_manifest` receives server-resolved artifact provenance, never a
  client hash.

- [ ] **Step 1: Write failing mode/purpose/expiry tests**

  Through the real API, assert allowed Custom Prompt optional source and Upload
  required source. Assert benchmark references, wrong purpose, missing,
  expired, rejected, and already-bound uploads fail with safe stable envelopes.

- [ ] **Step 2: Verify RED and implement transactional binding**

  Resolve the opaque record in the same database transaction as run creation,
  enforce state/purpose/expiry, mark it bound to the new run, and keep
  `official_eligible=false`. Concurrent second binding must fail.

- [ ] **Step 3: Write failing manifest provenance tests**

  Parse the stored exact manifest JSON and assert the source object contains
  only upload ID, purpose, content hash, file count, byte count, and retention
  class. Assert no storage key, path, filename, or source bytes.

- [ ] **Step 4: Implement manifest provenance and verify exact hashing**

  Update configuration ID to `phase-2-sandbox-uploads-v1`, replace the sandbox
  placeholder with the policy ID/image digest, and preserve exact canonical
  JSON byte hashing.

- [ ] **Step 5: Update TypeScript contracts without importing the Figma UI**

  Add literal upload-purpose/receipt/source-upload fields and a typed multipart
  client method. Run `corepack pnpm exec tsc --noEmit` and require no imports in
  `App.tsx`.

### Task 4: Docker policy and argument-safe command construction

**Files:**
- Create: `backend/app/sandbox/__init__.py`
- Create: `backend/app/sandbox/policy.py`
- Create: `backend/app/sandbox/process.py`
- Create: `backend/app/sandbox/executor.py`
- Create: `backend/config/sandbox-policy-v1.json`
- Create: `backend/tests/test_sandbox_policy.py`
- Create: `backend/tests/test_sandbox_executor_unit.py`

**Interfaces:**
- Produces: `SandboxPolicy`, `CommandProfile`, `ExecutionRequest`,
  `ExecutionResult`, `DockerProcessRunner`, and `DockerExecutor.execute(...)` /
  `cancel(execution_id)`.
- Production registry exposes only `phase2_policy_probe`; tests inject trusted
  profiles through the constructor rather than accepting commands from API data.

- [ ] **Step 1: Resolve and record the pinned image digest**

  Query the official image registry through Docker, select the explicit
  Linux/amd64 digest for the approved Python 3.14 Alpine tag, pull by digest,
  and record tag, platform digest, image ID, retrieval command, and timestamp in
  the policy JSON. Reject a tag-only reference in tests.

- [ ] **Step 2: Write failing policy-construction tests**

  Assert the complete literal Docker create argument list contains network
  none, UID/GID 65532, cap drop, no-new-privileges, read-only root, exact tmpfs,
  CPU/memory/PID limits, safe labels, and the digest reference. Assert it has no
  mount/volume/socket/device/privileged/host-namespace flags or environment
  passthrough. Unknown profiles and malformed IDs must fail before Docker runs.

- [ ] **Step 3: Implement frozen policy/contracts and verify GREEN**

  Validate all policy fields at construction and build subprocess argument
  arrays. Never concatenate or invoke `shell=True`.

- [ ] **Step 4: Write failing bounded-output/process tests**

  Use a real local child process to produce output beyond 64 KiB on both
  streams. Assert the runner drains the process without deadlock, retains only
  the bound, marks truncation, enforces wall timeout, and distinguishes
  cancellation. No test asserts only that a mock was called.

- [ ] **Step 5: Implement bounded readers and process lifecycle**

  Drain stdout/stderr concurrently into capped byte buffers, poll a cancellation
  event and monotonic deadline, terminate the local Docker attach client when
  the container is removed, and return decoded replacement-safe excerpts.

- [ ] **Step 6: Write failing executor cleanup branch tests**

  Inject a specific fake runner that mirrors complete create/copy/start/inspect/
  remove results. Assert cleanup after create failure, copy failure, non-zero
  exit, timeout, cancellation, and cleanup failure; assert no unregistered ID is
  removed and cleanup failure cannot return success.

- [ ] **Step 7: Implement executor orchestration and verify GREEN**

  Stage a read-only source snapshot, create the labeled container, copy source
  to `/input`, inspect policy evidence, attach/start, and force-remove the exact
  registered container in `finally`. Remove the host staging directory under
  the configured execution root after containment verification.

### Task 5: Live Docker isolation, cancellation, and cleanup evidence

**Files:**
- Create: `backend/tests/test_sandbox_live.py`
- Create: `backend/tests/fixtures/sandbox_probe.py`
- Modify: `backend/pytest.ini`
- Modify: `backend/README.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`
- Modify: `backend/.env.example`

**Interfaces:**
- A `docker_live` pytest marker runs only when explicitly selected; Phase 2 gate
  commands must select it and treat skips as gate failure.
- Probe output is canonical JSON with UID/GID, effective capabilities, root
  write result, workspace write result, route/interface facts, cgroup evidence,
  source writability, and source manifest hash.

- [ ] **Step 1: Write the failing live policy-probe test**

  Execute the real pinned container and assert UID/GID 65532, zero effective
  capabilities, no non-loopback network route, read-only root, writable temp
  workspace, read-only source, expected cgroup limits, bounded public result,
  no host mounts/socket, and no remaining labeled container/workspace.

- [ ] **Step 2: Run live test and verify RED for missing executor behavior**

  Run: `.\.venv\Scripts\python.exe -m pytest -m docker_live tests/test_sandbox_live.py -vv`

  Expected: fail at the first unimplemented policy/evidence assertion; a Docker
  availability skip is not accepted.

- [ ] **Step 3: Complete the minimal live probe path and verify GREEN**

  Adjust only implementation defects exposed by real Docker behavior. Re-run
  until the live policy probe passes with no leaked containers/workspaces.

- [ ] **Step 4: Add live failure, timeout, cancellation, and output tests RED**

  Inject backend-owned test profiles, run them in the real container, cancel a
  sleeping execution from a second thread, and assert bounded results plus zero
  matching containers after every case.

- [ ] **Step 5: Implement missing lifecycle behavior and verify GREEN**

  Keep cleanup idempotent and scoped to the registered execution. Do not add a
  broad label sweep or remove containers not created by this executor instance.

- [ ] **Step 6: Document exact local policy and commands**

  Document digest configuration, artifact root, retention cleanup, explicit
  live-test command, Docker Desktop Linux-container requirement, and the local-
  only/no-auth limitation. Do not claim the sandbox is a security certificate.

### Task 6: Full verification and gated handoff

**Files:**
- Modify: `RISK.md`
- Modify: `PHASE_STATUS.md`
- Create: `docs/phase-2/ANTIGRAVITY_HANDOFF.md`

**Interfaces:**
- `PHASE_STATUS.md` remains `Awaiting external review`, with commit and push
  truthfully `Not attempted`.
- The handoff contains scope, exact diff, commands/results, policy evidence,
  risks/limitations, reviewer checklist, and explicit PASS/BLOCK request.

- [ ] **Step 1: Run backend verification**

  Run the complete pytest suite with coverage, live Docker suite with skips
  forbidden, compileall, Alembic upgrade inspection, and PEP 751 dry-run install.

- [ ] **Step 2: Run frontend and preservation verification**

  Run TypeScript checking and production build. Compare SHA-256 for the four
  preserved Figma runtime-source files against Phase 1 and require exact match.

- [ ] **Step 3: Run security-focused checks**

  Scan tracked/untracked Phase 2 text for credential patterns and private host
  paths, inspect the full diff for public path/source leaks, list Docker policy
  evidence, and confirm no SecureEval-labeled containers remain.

- [ ] **Step 4: Conduct focused self-review**

  Review upload parsing, filesystem containment, archive metadata, DB/file
  transaction gaps, Docker argument construction, output draining, cancellation
  races, cleanup scope, public schemas, lock/digest provenance, and Phase 1
  regressions. Fix each finding through a new RED/GREEN cycle.

- [ ] **Step 5: Update risks and phase status**

  Record evidence for R-05 through R-09, R-27, R-28, R-31, R-32, R-38, and R-39
  plus any new risks. Mark Phase 2 awaiting external review; do not mark closed.

- [ ] **Step 6: Prepare and validate Antigravity handoff**

  Populate `docs/phase-2/ANTIGRAVITY_HANDOFF.md`, run `git diff --check`, and
  provide the user the file link plus the external reviewer prompt. Stop with
  all Phase 2 changes uncommitted and unpushed.
