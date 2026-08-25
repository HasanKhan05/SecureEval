# SecureEval Phase 0–2 Risk Mitigation Design

## Status and authority

Approved in chat by the user on 2026-08-25. This specification governs a
hardening extension to Phase 2. It does not authorize Phase 3 implementation.
The existing product, architecture, API, security, testing, reproducibility,
and phase-control documents remain authoritative unless this document records a
narrower hardening decision.

## Objective

Mitigate every risk introduced in or materially actionable through Phase 2,
with executable evidence, before closing Phase 2 or beginning Phase 3. A risk
may be marked `Mitigated` only when its current attack surface has a concrete
control and a passing automated or live verification. Recurring risks must be
revalidated when later phases add new attack surfaces.

## Scope boundary

This work covers R-01–R-09 and R-35–R-41 because those risks originate in or
are directly actionable through Phases 0–2. R-27, R-28, R-31, and R-32 are also
covered where Phase 2 has already introduced source artifacts, public evidence,
dependencies, or retention behavior.

This work does not implement scanners, the benchmark corpus/evaluator, repair
strategies, LLM roles, result interpretation, official scoring, or report UI.
For a recurring risk whose later sink does not exist yet, the current surface is
hardened and the register must state the exact later-phase revalidation trigger.

## Supported environments

- Developer frontend: Node.js 22 and pnpm 10.34.3, matching the supplied Figma
  Make pins.
- Developer backend: Python 3.14 on Windows with the existing hashed PEP 751
  lock.
- Sandbox verification: Docker Desktop Linux engine locally and a native Linux
  Docker engine in CI.
- Production claim: none. Passing native Linux CI establishes the supported
  reference environment, not a universal Docker-host guarantee.

## Design decisions

### 1. Self-contained preserved frontend baseline

The three remote Google font families used by the Figma export will be stored
under `frontend/src/assets/fonts/` with their license notices. `index.css` will
use local `@font-face` sources while retaining the same family names, weights,
fallback order, layout, colors, spacing, and navigation.

The Figma mock category and strategy choices will use the canonical governing
taxonomy:

- categories: `injection`, `authentication_authorization`, `secrets`,
  `input_validation`, `dependency_configuration`;
- strategies: `vulnerability_specific_v1`, `scanner_feedback_v1`,
  `test_feedback_v1`, plus the existing `run_all` selection behavior.

Only conflicting labels, identifiers, and mock fixtures may change. No visual
redesign is allowed. A source-hash inventory and deterministic rendered
screenshots at the existing desktop viewport will form the new repository-owned
baseline. The TypeScript compiler must enforce that UI adapters use the shared
contract identifiers rather than independent strings.

### 2. Server authority and SQLite resilience

The API remains authoritative for status, eligibility, manifests, metrics, and
artifact binding. Contract tests will continue rejecting client-supplied
authoritative fields.

SQLite connections will enable foreign keys, WAL journal mode, and a bounded
busy timeout. Every state transition and upload claim will use a conditional
write so concurrent callers cannot overwrite a newer state. On application
startup, records left in `running` by an interrupted local process will move to
the existing `failed` state with `failure_code=worker_interrupted`, a bounded
cleanup state, and an `updated_at` timestamp. Recovery must be idempotent and
must not alter queued, completed, failed, or cancelled records.

### 3. Upload validation and extraction bounds

Multipart transport remains capped at 2 MiB. ZIP metadata is inspected before
content reads. Each member will then be streamed in bounded chunks while the
validator enforces actual, not merely declared, member and aggregate expanded
bytes. The canonical limits remain 100 files, 10 MiB expanded bytes, 20:1
expansion ratio, path depth 8, and path length 240.

Validation must reject absolute, drive, UNC, traversal, empty, dot, trailing
dot/space, control-character, NTFS ADS, reserved-device, duplicate/casefold,
symlink, hardlink, special-file, encrypted, invalid, nested-archive,
unsupported-type, unsupported-encoding, binary, excessive-count, excessive-size,
excessive-depth, and excessive-ratio inputs. No archive extraction API may write
directly to the host filesystem.

Adversarial tests will include mismatched/hostile ZIP metadata and deterministic
mutation cases around separators, Unicode/case identities, mode bits, sizes,
and compression fields.

### 4. Retention and deletion lifecycle

Exploratory uploads retain the 24-hour class. A background cleanup loop owned by
the FastAPI lifespan will periodically select expired or interrupted-deletion
records. Cleanup uses an idempotent state machine:

1. atomically claim `available`/expired records as `deleting`;
2. remove only the opaque, containment-validated artifact directory;
3. mark metadata `deleted`, set `deleted_at`, and append an `artifact_deleted`
   audit record;
4. resume safely on startup when a record was left in `deleting`.

Filesystem absence is treated as successful idempotent cleanup. A filesystem
failure leaves the record retryable and writes a bounded reason code without a
host path. Cleanup timing is configurable for tests but bounded to a safe
minimum in normal runtime. The API must not bind `deleting`, expired, or deleted
artifacts.

### 5. Sandbox staging, isolation, and capacity

The executor continues to accept only trusted command profiles and the exact
pinned image digest. Before staging, it walks the source tree without following
links and rejects symlinks, junction-like/reparse entries, special files,
containment escapes, unsupported extensions, excessive file count, and actual
byte totals beyond the upload policy.

Container policy retains no network, non-root UID/GID, all capabilities dropped,
`no-new-privileges`, read-only root, no host mounts, no Docker socket/devices,
and bounded tmpfs/CPU/RAM/PIDs/time/output. It will also isolate IPC, bound open
files, and retain Docker's default seccomp profile. Process-wide concurrency is
bounded by a fail-fast capacity gate shared by all executor instances. The
supported deployment topology is one API/coordinator process; startup must fail
closed when a multi-worker configuration is requested until a future durable
lease coordinator exists. Unbounded container creation is not allowed.

All cleanup paths remove the exact labeled container and exact execution staging
directory. Startup cleanup may remove only stale containers carrying the
SecureEval label and a syntactically valid execution ID. It must never enumerate
and delete unlabeled containers or broad host paths.

### 6. Output confidentiality

Container stdout/stderr remains jointly bounded. Before an execution result can
be persisted or returned, a deterministic redactor replaces:

- common credential/token/private-key patterns;
- environment-provided secret values supplied to the redactor;
- Windows and POSIX absolute private paths;
- the private artifact and execution roots.

The redactor records only whether redaction occurred, never the matched secret.
Tests use synthetic secrets and paths. The container environment remains an
explicit two-variable allowlist and tests prove arbitrary host secrets do not
cross the boundary.

Phase 2 remains single-user and loopback-only. The application will reject
non-loopback client addresses and non-local Host headers, will not trust proxy
forwarding headers, and will document that a reverse proxy or remote bind is an
unsupported configuration. This mitigates the current unauthorized remote
access surface without pretending browser authentication exists. R-28 must
reopen before Phase 7 introduces a real remotely accessible or multi-user UI.

### 7. Generated-diff safety prerequisite

Phase 2 will add a non-executing patch-validation primitive but will not build a
repair strategy. It accepts a bounded UTF-8 unified diff and returns a normalized
change manifest. It rejects absolute/traversal/drive/UNC/ADS paths, paths outside
the validated source manifest, binary patches, symlink or special-mode changes,
renames/copies, unsupported file types, excessive changed files/bytes, and
malformed hunks. It performs no filesystem mutation.

Phase 5 must use and revalidate this primitive before applying generated changes
inside an isolated candidate workspace. R-09 is mitigated for the available
validation surface and automatically reopens if Phase 5 bypasses the primitive.

### 8. Supply-chain and cross-platform evidence

The Windows PEP 751 lock remains immutable for its declared environment. A
separately generated, hashed Python 3.14 Linux lock will be committed; runtime
documentation must select the lock by platform and reject unsupported silent
resolution. The exact Docker digest and frontend frozen lock remain mandatory.

A GitHub Actions workflow will run on native Ubuntu using Node 22, pnpm 10.34.3,
Python 3.14, and Docker. Actions must be pinned to immutable commit SHAs. CI will
run the backend suite including live Docker checks, both lock dry-runs where
applicable, frontend type/build tests, taxonomy contracts, and secret/private
path scans. Current dependency/container vulnerability audit output will be
recorded as evidence; future advisories remain a recurring revalidation trigger.

### 9. Governing-document consistency

References to a nonexistent `SECURITY.md` will be corrected to
`SECURITY_DESIGN.md`. References to Phase 10 will be corrected to Phase 9 where
the implementation plan and phase tracker define the release gate. Historical
risk evidence will not be rewritten or deleted.

## Error handling

- Public upload and binding failures keep the existing typed, redacted envelope.
- Capacity exhaustion returns a structured unavailable/busy state rather than
  silently queueing unlimited work.
- Cleanup failures retain retryable metadata and bounded audit reason codes.
- Sandbox host-operation errors expose no Docker command output, source, secret,
  or host path through public results.
- CI or audit unavailability is a failed/blocked mitigation check, not a pass.

## Verification and risk-closure matrix

| Risks | Required closure evidence |
|---|---|
| R-01, R-02 | Local licensed fonts, reproducible source/render baseline, unchanged layout review |
| R-03 | Server-ownership contract tests and shared typed UI identifiers |
| R-04 | WAL/busy-timeout/foreign-key checks, concurrent transitions, idempotent startup recovery |
| R-05, R-06 | Policy inspection plus native/local live Docker escape, network, env-secret, filesystem, and cleanup tests |
| R-07 | Concurrency, CPU, RAM, PID, open-file, tmpfs, timeout, output, and cancellation evidence |
| R-08 | Streaming actual-byte enforcement and hostile/mutated archive suite |
| R-09 | Pure bounded diff validator tests; mandatory Phase 5 revalidation trigger |
| R-27, R-28 | Output redaction tests and enforced local-only deployment boundary; authentication reopens at first remote/multi-user scope |
| R-31, R-38 | Exact Windows/Linux locks, digest evidence, frozen frontend lock, native Linux CI and current audits |
| R-32, R-41 | Periodic/startup expiry cleanup, retry recovery, deletion audit, and no-bind tests |
| R-35 | Canonical category/strategy identifiers shared by UI contracts and backend while layout is preserved |
| R-36 | Document consistency scan returns no stale filename/phase references except quoted historical evidence |
| R-37 | CI uses Node 22 and pnpm 10.34.3 and reproduces the frontend build |
| R-39 | Existing completed Codex Security scan plus a new final hardened diff scan |
| R-40 | Native Linux Docker CI passes the same policy evidence as local Docker Desktop |

## Completion gate

Phase 2 may close only when:

1. every new behavior followed red/green TDD;
2. the full backend suite, live Docker suite, compile check, Windows/Linux lock
   checks, frontend type/build checks, visual/source preservation checks,
   security scans, audit checks, and hygiene checks pass;
3. `RISK.md` records exact evidence and later-phase revalidation triggers;
4. `PHASE_STATUS.md` records the user-waived external gate, final commits, push,
   remaining limitations, and truthful PR state;
5. the hardened Phase 2 branch is pushed; and
6. no Phase 3 implementation has begun.

After closure, Phase 3 starts from the hardened Phase 2 commit and follows its
own design/TDD/self-review process.
