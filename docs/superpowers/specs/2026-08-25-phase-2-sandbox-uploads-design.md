# Phase 2 Sandbox and Upload Intake Design

## Status and authority

This document refines Phase 2 of `IMPLEMENTATION_PLAN.md`. The repository-root
planning package remains governing if any wording conflicts. Phase 2 must stop
for external Antigravity review before commit or push.

## Scope

Phase 2 adds two boundaries without changing the Figma UI:

1. validated exploratory source intake for Custom Prompt and Upload Existing
   Code modes; and
2. a Docker executor foundation that runs only trusted command profiles against
   validated source under a fixed security policy.

Scanner execution, benchmark fixtures, repair strategies, LLM calls, metrics,
and frontend wiring remain later-phase work.

## Upload contract

`POST /api/v1/uploads` accepts one bounded multipart part named `source` and a
`purpose` field with `custom_prompt_context` or `uploaded_code`. The response is
a redacted `UploadReceipt` containing only schema version, opaque upload ID,
purpose, normalized file count, total bytes, canonical content hash, retention
class, expiry, and creation time. There is no public raw-download endpoint.

The accepted first-release surface is deliberately small:

- individual UTF-8 text files: `.py`, `.js`, `.jsx`, `.ts`, `.tsx`, `.json`,
  `.toml`, `.yaml`, `.yml`, `.md`, and `.txt`;
- ZIP archives containing only those source types;
- at most 2 MiB in the HTTP upload, 100 normalized files, 10 MiB expanded
  content, 20:1 aggregate expansion, path depth 8, and 240 characters per
  normalized relative path; and
- no empty intake, duplicate normalized/case-folded paths, NULs, absolute or
  drive/UNC paths, `.`/`..` traversal, encrypted entries, symlinks, special
  files, nested archives, unsupported encodings, or binary content.

Validation inspects archive metadata before extraction, streams bounded content
through validation, and writes only to a newly created private staging
directory after containment checks. Failure deletes all staging data and
returns the standard `upload_rejected` envelope without echoing filenames or
host paths.

Accepted files are canonicalized by normalized POSIX path and raw bytes. A
manifest sorted by path records per-file SHA-256 and size; its canonical JSON
hash is the receipt content hash. The raw transport file is deleted after
normalization. The normalized artifact is stored outside any served directory
under an opaque `upload_<32 hex>` directory and metadata is recorded in SQLite.
Exploratory uploads use a configurable 24-hour default expiry; official fixtures
will use a separate retention class in Phase 4.

Custom Prompt runs may include both `custom_prompt` and an optional validated
`upload_id` whose purpose is `custom_prompt_context`. Upload runs require a
validated, unexpired `upload_id` whose purpose is `uploaded_code`.
Benchmark runs reject upload references. The server resolves and freezes the
artifact hash into the run manifest; the client cannot supply a path or hash.

## Docker executor

The executor uses argument-list subprocess calls to the Docker CLI, never a
shell command. It accepts only backend-owned command profile IDs; uploaded code
cannot choose the executable or Docker flags. The Phase 2 profile runs a fixed
probe command, establishing the boundary used by scanners and tests in Phase 3.

The sandbox image reference must include `@sha256:<64 hex>` and is recorded in
policy evidence. Container creation applies all of these controls:

- `--network none`;
- `--user 65532:65532`;
- `--cap-drop ALL` and `no-new-privileges`;
- read-only root filesystem;
- no bind mounts, named volumes, Docker socket, devices, privileged mode, or
  host namespaces;
- writable `tmpfs` workspace with `rw,noexec,nosuid,nodev,size=64m`;
- 1 CPU, 512 MiB memory, 64 PIDs, 60-second wall timeout, and 64 KiB combined
  retained output; and
- labels containing only a SecureEval execution ID for scoped cleanup.

Validated source is copied into the container without a host mount and becomes
read-only to the executed command. Only the isolated temp workspace is writable.
The executor returns a bounded result containing execution ID, state, exit code,
timeout/output-truncation flags, redacted stdout/stderr excerpts, policy ID,
image digest, timestamps, and cleanup state. It never returns container IDs,
host paths, environment values, or unrestricted logs.

Every execution registers its container before start. A `finally` cleanup path
force-removes the exact registered container and deletes its host-side staging
workspace after success, non-zero exit, start failure, timeout, or cancellation.
Cancellation targets an opaque execution ID and never interpolates user input
into Docker selectors. Cleanup is idempotent and records `completed` or
`failed`; a cleanup failure makes the execution result failed rather than
silently successful.

## Persistence and audit evidence

The Phase 2 migration adds upload-artifact and sandbox-execution metadata with
opaque identifiers, hashes, purpose/retention, sizes, timestamps, state, policy
ID, image digest, bounded log fields, and cleanup state. Filesystem paths and
raw source are absent from public schemas. Audit events record upload accepted
or rejected reason codes, artifact binding to a run, execution state changes,
cancellation, expiry deletion, and cleanup outcome without source content.

## Error behavior

Upload failures use `upload_rejected` plus a stable non-sensitive reason code in
server-side audit metadata. Sandbox outcomes use `sandbox_timeout`,
`sandbox_cancelled`, `sandbox_policy_error`, `tool_error`, or `internal_error`.
Unexpected exceptions retain the Phase 1 safe envelope and no traceback.

## Verification

Tests are written before production code and cover:

- valid single-file and ZIP intake plus canonical hashing;
- traversal, absolute/drive paths, duplicate normalized paths, symlink mode,
  encrypted/nested archives, binary/invalid UTF-8, unsupported types, size,
  count, depth, name-length, and expansion limits;
- failed-validation staging cleanup, expiry deletion, purpose/mode binding, and
  absence of public paths/source;
- Docker policy construction with exact safe arguments and rejected unpinned
  images or unknown command profiles;
- live Docker evidence for no network, non-root identity, dropped capabilities,
  read-only root, writable bounded temp workspace, resource/PID/output/time
  limits, and absence of host mounts/socket;
- cleanup after success, failure, timeout, and cancellation; and
- unchanged Phase 1 API behavior, frontend type-check/build, secret scan, and
  unchanged Figma runtime-source hashes.

Live Docker tests are required evidence for the Phase 2 gate and may not be
replaced by mocked subprocess assertions. Unit tests may use a narrow fake
process runner only to exercise error branches that cannot be induced safely.

## Gate

After self-tests and focused security self-review, update `RISK.md` and mark
Phase 2 as awaiting external review in `PHASE_STATUS.md`. Prepare the exact diff,
test commands/results, Docker policy evidence, known limitations, and review
instructions. Do not commit, push, or start Phase 3 until the user's Antigravity
review returns an explicit Pass and Phase 2 is then closed.
