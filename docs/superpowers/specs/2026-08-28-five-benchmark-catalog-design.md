# Five Controlled Benchmarks Design

## Goal

Expand the controlled portfolio benchmark from T-01 to five real, deterministic Python tasks while reusing the existing Pytest, Bandit, Semgrep, repair, scoring, persistence, and Figma UI flow.

## Catalog

| ID | Title | Primary risk | Controlled behavior |
|---|---|---|---|
| T-01 | User Login Service | SQL injection | SQLite lookup with fixed tests |
| T-02 | Document File Reader | Path traversal | Read files only from a supplied document root |
| T-03 | Command Argument Builder | Command injection | Build an allowlisted command without shell execution |
| T-04 | API Token Configuration | Hardcoded secret | Read a token from an injected environment mapping |
| T-05 | Password Digest Utility | Weak hashing | Produce and verify PBKDF2 password digests |

Each fixture contains `fixture.json`, `source/app.py`, and `tests/test_app.py`. Tests execute only these repository-controlled fixtures. No upload or model-generated source is routed through the benchmark Pytest runner.

## Registry and routing

- Add a typed benchmark registry mapping the five IDs to immutable metadata and fixture directories.
- Run creation rejects unknown task IDs.
- The benchmark runner resolves the selected task from the persisted run record rather than using one global fixture root.
- Reports identify the controlled task and retain `benchmark_full` evidence.
- The frontend catalog shows exactly these five live tasks and removes misleading demo-only tasks/counts.

## Repairs

- The real API remains optional for controlled benchmarks.
- When no API key is configured, deterministic local repairs cover the demonstrated defect in each of the five fixtures.
- Repair strategies differ in supplied context but use the same minimal corrected behavior for the local fallback.
- All candidates rerun the task's fixed tests and both scanners before deterministic scoring.

## Verification

- Registry and unknown-ID tests.
- Parameterized end-to-end tests for all five benchmarks.
- Tests proving the selected fixture—not T-01—is copied and executed.
- Scanner/repair assertions per task and report persistence after refresh.
- Frontend contract and browser selection tests for all five tasks.

## Non-goals

- A 24-task research corpus.
- Hidden evaluator infrastructure.
- Production benchmark governance or aggregate publication.
- Executing uploaded or custom-generated source as a controlled benchmark.

