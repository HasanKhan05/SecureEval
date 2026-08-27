# Task 3 report: safely materialize uploaded Python source

## Status

pass

## Implementation

- Added `ArtifactStore.copy_single_python_source(upload_id, destination)`.
- Added `load_uploaded_python(store, upload_id, destination)` and `UploadSourceError`.
- The store method requires exactly one resolved `.py` file, verifies the source directory and file remain under the artifact root, creates an exclusive run destination, and copies bytes without importing or executing them.
- The loader strictly decodes the copied bytes as UTF-8 and wraps store/read failures in `UploadSourceError`.
- Added coverage for a non-executing source, multiple files, missing artifacts, non-Python source, invalid UTF-8, and escaped source paths.

## TDD evidence

RED:

`python -m pytest tests/test_upload_source.py -q`

Result: collection failed as expected with `ModuleNotFoundError: No module named 'app.upload_source'` before the loader implementation existed.

GREEN:

`python -m pytest tests/test_upload_source.py -q`

Result: `6 passed`.

Regression:

`python -m pytest tests/test_upload_source.py tests/test_artifact_store.py tests/test_upload_validation.py -q`

Result: `40 passed`.

## Files changed

- `backend/app/upload_source.py`
- `backend/app/uploads/store.py`
- `backend/tests/test_upload_source.py`
- `.superpowers/sdd/2026-08-27-real-upload-static-analysis/task-3-report.md`

## Self-review

- Upload identifiers continue through the existing `_artifact_root` validation.
- Resolved source directory and file are both checked against the resolved artifact root; a resolved file must also remain under the source directory.
- Missing, multi-file, and non-`.py` inputs fail before copying; destination creation is exclusive and run-specific.
- Strict UTF-8 decoding rejects malformed bytes after copying.
- No `compile`, `exec`, `eval`, `importlib`, `subprocess`, or Pytest adapter call was added.
- Existing store write, retention, deletion, and validation behavior is unchanged.

## Concerns

- Symlink creation is unavailable in this Windows test environment, so the path-escape test uses a deterministic escaped-source-store fixture; the production check is on resolved paths.
- No external reviewer was required for this task.

## Fix Round 1

### Finding and ruling

The external review found that arbitrary destinations were accepted, so a caller could copy outside the intended run area. The ruling was to make a trusted root explicit in both APIs and enforce resolved containment before and after destination creation. This changes the interfaces to `copy_single_python_source(upload_id, destination, trusted_root)` and `load_uploaded_python(store, upload_id, destination, trusted_root)`; later upload-runner code must pass `RunnerDependencies.work_root`.

### Covering tests

- Absolute destination outside the trusted root is rejected before any directory is created.
- A `..`-resolved parent escape is rejected before any directory is created.
- A symlinked destination parent is rejected when the Windows environment permits symlink creation; this environment skipped that one case because symlink creation is unavailable.
- Existing source-side containment, file-count, extension, UTF-8, and no-execution tests remain active.

### TDD evidence

RED:

`python -m pytest tests/test_upload_source.py -q`

Result: `8 failed, 1 skipped`; all failures were the expected `TypeError` because the old loader accepted only three positional arguments.

GREEN and regression:

`python -m pytest tests/test_upload_source.py -q`

Result: `8 passed, 1 skipped`.

`python -m pytest tests/test_upload_source.py tests/test_artifact_store.py tests/test_upload_validation.py -q`

Result: `40 passed, 1 skipped`.

### Self-review

Destination is resolved with `strict=False` and checked under the resolved trusted root before creation. After exclusive creation, it is resolved again and checked before deriving the output path or copying bytes. Source-side resolved artifact-root checks were not weakened. No execution, import, subprocess, or Pytest-adapter sink was added.

### Concerns

A real symlink-parent test cannot run under the current Windows permissions; the deterministic `..`-resolved parent test proves the same pre-creation containment interface, and the symlink test runs automatically where supported.