# SecureEval — Phase 2 Review Request

> Historical audit artifact: the user explicitly waived the external
> Antigravity gate for Phase 2 on 2026-08-25. This document is retained as a
> complete Codex self-review/evidence package; no external verdict is claimed.

## Phase objective

Implement pinned Docker executor with safety policy and bounded artifact/log
collection. Implement Custom Prompt source intake and Upload Existing Code
validation/retention boundary.

Acceptance: hostile archive/path/symlink/binary cases reject; executor has
policy evidence; cleanup occurs for success/failure/cancel. QA: integration plus
hostile-input suite. Specialist: sandbox/security reviewer.

## Scope implemented

- Added bounded multipart intake for one allowlisted UTF-8 source file or ZIP.
- Added hostile archive/path/encoding/type/count/size/depth/ratio rejection,
  including Windows ADS, device names, and invalid path characters.
- Added opaque private exploratory artifact storage, canonical manifests and
  hashes, 24-hour expiry metadata, scoped deletion, and accepted/rejected audit
  records.
- Added purpose/expiry/state validation and an atomic one-time upload-to-run
  claim; immutable redacted provenance is frozen into the run manifest.
- Added a trusted-profile Docker executor pinned to
  `python@sha256:31da4cb527055e4e3d7e9e006dffe9329f84ebea79eaca0a1f1c27ce61e40ca5`.
- Added no-network, non-root, dropped-capability, no-new-privileges, read-only
  root, no-mount, tmpfs, CPU/RAM/PID/time/output, cancellation, and cleanup
  controls with live policy evidence.
- Updated the unimported typed frontend API client/contract only; the Figma
  runtime UI remains untouched.

## Files changed

- Added: `backend/app/sandbox/__init__.py`,
  `backend/app/sandbox/executor.py`, `backend/app/sandbox/policy.py`,
  `backend/app/uploads/__init__.py`, `backend/app/uploads/policy.py`,
  `backend/app/uploads/service.py`, `backend/app/uploads/store.py`,
  `backend/app/uploads/validation.py`,
  `backend/config/sandbox-policy-v1.json`,
  `backend/migrations/versions/0002_phase2_artifacts.py`,
  `backend/tests/test_artifact_store.py`,
  `backend/tests/test_run_source_binding.py`,
  `backend/tests/test_sandbox_live.py`,
  `backend/tests/test_sandbox_policy.py`, `backend/tests/test_upload_api.py`,
  `backend/tests/test_upload_validation.py`,
  `frontend/src/api/upload-response.contract-test.ts`, and the Phase 2 design/
  execution documents under `docs/superpowers/`.
- Modified: `PHASE_STATUS.md`, `RISK.md`, `backend/.env.example`,
  `backend/README.md`, `backend/app/main.py`, `backend/app/manifests.py`,
  `backend/app/models.py`, `backend/app/schemas.py`, `backend/app/services.py`,
  `backend/pyproject.toml`, `backend/pylock.toml`, `backend/pytest.ini`,
  `backend/tests/conftest.py`, `backend/tests/test_manifest.py`,
  `backend/tests/test_migrations.py`, `docs/LOCAL_DEVELOPMENT.md`,
  `frontend/src/api/client.ts`, and `frontend/src/contracts/api-v1.ts`.
- Deleted: none.
- Review base: Phase 1 closeout
  `a9fbf4fff96c8bbf7cf61b8193dc8b4419519410`; Phase 2 is intentionally an
  uncommitted working-tree diff.

## Figma preservation check

- Existing screens/flows affected: none.
- Mocked behavior replaced: none; UI integration remains Phase 7.
- Intentional visual changes: none.
- Reproduction: from `frontend/`, run
  `git diff --name-only a9fbf4fff96c8bbf7cf61b8193dc8b4419519410 -- src/App.tsx src/index.css src/main.tsx vite.config.ts`;
  expected output is empty. The production asset names remain
  `index-CB96F2qe.css` and `index-D5WNH3xq.js`.

## API and data-contract changes

- Added `POST /api/v1/uploads` with multipart `purpose` and `source` fields and
  typed `UploadReceipt`; rejection returns the existing redacted error envelope.
- `RunCreate` allows an optional `custom_prompt_context` upload for Custom Prompt
  mode and requires `uploaded_code` for Upload mode.
- Added `UploadArtifactRecord` and `AuditEventRecord`.
- Added Alembic revision `0002_phase2` with `upload_artifacts`, `audit_events`,
  expiry/bound indexes, and a run foreign key.
- Added exact `python-multipart==0.0.32` and regenerated the hashed Python
  3.14/Windows PEP 751 lock.
- Existing Phase 1 lifecycle responses remain compatible; manifest configuration
  is intentionally versioned as `phase-2-sandbox-uploads-v1`.

## Security/research controls affected

- Sandbox/upload boundary: this is the primary scope. Validate the archive
  policy, filesystem containment, immutable staging, trusted Docker command
  profiles, digest pin, isolation flags, bounded output, and cleanup paths.
- Hidden benchmark boundary: not implemented until Phase 4; no evaluator data is
  introduced here.
- Official versus exploratory predicate: upload artifacts and both intake modes
  remain exploratory; `official_eligible` remains server-owned and false.
- LLM prompts/contracts/cost tracking: not applicable until Phase 6.
- Manifest/version controls: run manifests freeze redacted source-artifact hash/
  counts/purpose/retention data plus sandbox policy ID and exact image digest.

## Verification performed by Codex

| Check | Exact command or procedure | Result | Evidence path/output summary |
|---|---|---|---|
| Backend unit/integration/hostile/live Docker | `cd backend; .\.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing` | PASS | 69 passed, 94% coverage, one upstream warning; includes live isolation, failure, timeout, output, cancellation, cleanup, uploads, migration, and concurrent binding |
| Python compilation | `cd backend; .\.venv\Scripts\python.exe -m compileall -q app migrations tests` | PASS | No diagnostics |
| Locked dependency install | `cd backend; .\.venv\Scripts\python.exe -m pip install --dry-run --ignore-installed -r pylock.toml` | PASS | Exact locked graph resolved; pip emitted only its PEP 751 experimental warning |
| Frontend type/build | `cd frontend; corepack pnpm exec tsc --noEmit; corepack pnpm build` | PASS | Typecheck clean; Vite 8.0.5 built 16 modules |
| Figma preservation | Runtime-source diff command above | PASS | Empty diff for App/CSS/main/Vite config; compiled asset hashes unchanged |
| Automated security diff | Codex Security working-tree scan | PASS | Scan `153fd200-61c2-4b23-90ab-0ca3024da7fd`: 20 files, six surfaces, complete coverage, zero findings |
| Hygiene/cleanup | `git diff --check`; secret/private-path scan; `docker ps -a --filter label=secureeval.execution_id --quiet` | PASS | No whitespace errors, matching secrets/private paths, or leaked labeled containers |

## Self-review corrections

- Added red/green regression cases and rejection for NTFS alternate data streams,
  Windows reserved device names, trailing-dot/space segments, control bytes, and
  invalid Windows path characters.
- Added a deterministic concurrent API regression that initially produced two
  successful bindings; replaced read-then-write with an atomic conditional
  database claim. Final result is exactly one `201` and one safe `409`.

## Known limitations and failures

- Authentication/authorization is not part of Phase 2. The API is local-only and
  must not be exposed to an untrusted network (R-28).
- The artifact store records a 24-hour expiry, refuses expired binding, and has
  scoped deletion logic, but no automatic deletion scheduler or deletion-audit
  integration yet (R-32/R-41).
- Live sandbox evidence is from Docker Desktop's Linux engine. The Docker daemon
  and pinned base image are trusted infrastructure; production Linux-host
  equivalence is unverified (R-40).
- The executor is a tested foundation with trusted profiles; scanner and repair
  orchestration/public execution endpoints belong to later phases.
- The committed Python lock is intentionally Python 3.14/Windows-specific
  (R-38).
- The patch helper repeatedly failed because the Windows sandbox refresh helper
  errored. Exact guarded file replacements were used, and all final diff/tests
  passed.

## Required review focus

- Independently inspect and test Docker isolation: no network, root, effective
  capabilities, privilege escalation, host mounts/socket, writable root/source,
  or unbounded CPU/RAM/PIDs/time/output; verify cleanup for success, failure,
  timeout, cancellation, and exceptional host paths.
- Attack upload handling with traversal, absolute/UNC/drive/ADS/reserved paths,
  duplicates/case collisions, symlinks/hardlinks/special files, invalid/encrypted/
  nested archives, forged metadata/decompression abuse, binaries, encodings,
  and configured size/count/depth/ratio boundaries.
- Verify opaque/private storage containment, one-time concurrent run binding,
  redacted receipts/errors/manifests/audit data, exploratory eligibility, and no
  source/private-path leakage.
- Confirm the Figma runtime sources and compiled UI are unchanged.

## Proposed RISK.md updates

- R-05/R-06/R-07/R-08: observed with policy and live/adversarial evidence; remain
  open pending independent/production validation.
- R-09: open; generated patch validation remains Phase 5.
- R-27/R-28: open; public output is bounded/redacted, but authentication is absent.
- R-31/R-38: digest/lock observed; cross-platform review remains.
- R-32/R-41: open; expiry and deletion primitives exist, automatic scheduler does
  not.
- R-39: Phase 2 automated diff scan completed successfully.
- R-40: new/open Docker daemon and production-host equivalence risk.

## Proposed PHASE_STATUS.md entry

- Status: Awaiting external review.
- Remaining work/blockers: external Antigravity `PASS` is required; then Codex
  will record the verdict, close Phase 2, commit, and push.
- Commit/push: not performed pending external verdict.

## Review request

Please use `ANTIGRAVITY_REVIEWER_PROMPT.md`, independently inspect this working
folder and diff, run feasible checks, and return the exact required Phase 2
verdict format. A `PASS` is required before Codex may commit/push this phase.
