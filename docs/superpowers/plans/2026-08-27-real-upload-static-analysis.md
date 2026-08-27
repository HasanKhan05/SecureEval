# Real Upload Code Static Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Upload Code mode to real local syntax validation, Bandit/Semgrep scanning, repair, rescanning, static-only scoring, persistence, and refresh recovery without executing uploaded source or tests.

**Architecture:** Reuse the existing upload artifact and run lifecycle. Add mode-aware evidence contracts and static scoring, isolate shared runner lifecycle helpers, implement an upload runner that only reads/copies source and invokes static tools, dispatch by persisted run mode, and generalize the live React hook/screens for benchmark and upload reports.

**Tech Stack:** Python 3.14, FastAPI, Pydantic, SQLAlchemy/SQLite, Bandit, Semgrep, React 18, TypeScript, Vite, Playwright Core, pytest.

**Spec:** `docs/superpowers/specs/2026-08-27-real-upload-static-analysis-design.md`

## Global Constraints

- Preserve the supplied Figma interface; replace data behavior only.
- The first connected upload slice accepts one UTF-8 `.py` source file; ZIP project execution is out of scope.
- Never import, compile with execution, or invoke uploaded source or uploaded tests.
- Syntax validation uses `ast.parse`; static analysis uses the installed Bandit and Semgrep adapters.
- Uploaded results are exploratory and never enter controlled benchmark aggregates.
- An empty finding list is scanner-clean only when both scanner executions completed.
- Do not send source to an external model unless the user explicitly configured an OpenAI-compatible key/model and selected a repair strategy.
- Keep the existing deterministic local fallback; failure to recognize a repair pattern is an explicit repair failure, never fabricated success.
- No new runtime dependency is required.

---

### Task 1: Add syntax evidence and static-only scoring contracts

**Files:**
- Create: `backend/app/static_evidence.py`
- Create: `backend/tests/test_static_evidence.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/scoring.py`
- Modify: `backend/app/reports.py`
- Modify: `backend/tests/test_scoring.py`
- Modify: `backend/tests/test_reports.py`

**Interfaces:**
- Produces: `validate_python_syntax(source: str) -> SyntaxValidation`
- Produces: `unavailable_functional_tests() -> TestExecution`
- Produces: `score_static_strategy(baseline: StaticEvidenceSnapshot, repaired: StaticEvidenceSnapshot) -> StrategyMetrics`
- Extends: `RunReport.evaluation_kind`, `RunReport.baseline_syntax`, `StrategyResult.repaired_syntax`, and `StrategyMetrics.score_basis`
- Changes: `StrategyMetrics.functionality_score` from `float` to `float | None`

- [ ] **Step 1: Write failing syntax and static-scoring tests**

```python
from app.scoring import StaticEvidenceSnapshot, score_static_strategy
from app.static_evidence import unavailable_functional_tests, validate_python_syntax


def test_syntax_validation_never_executes_source() -> None:
    marker = "raise RuntimeError('must never execute')\n"
    result = validate_python_syntax(marker)
    assert result.status == "completed"
    assert result.valid is True


def test_syntax_validation_reports_location_without_source_execution() -> None:
    result = validate_python_syntax("def broken(:\n    pass\n")
    assert result.status == "failed"
    assert result.valid is False
    assert result.line == 1
    assert result.message


def test_unavailable_functional_tests_are_explicit() -> None:
    result = unavailable_functional_tests()
    assert result.status == "unavailable"
    assert result.passed == result.failed == result.skipped == 0
    assert "not executed" in result.output.lower()


def test_static_score_uses_only_completed_syntax_and_scan_evidence() -> None:
    metrics = score_static_strategy(
        StaticEvidenceSnapshot(2, "completed", True),
        StaticEvidenceSnapshot(0, "completed", True, cost_usd=0.01),
    )
    assert metrics.score_basis == "static_only"
    assert metrics.security_score == 100
    assert metrics.functionality_score is None
    assert metrics.overall_score == 100


def test_static_score_is_zero_when_rescan_is_unavailable() -> None:
    metrics = score_static_strategy(
        StaticEvidenceSnapshot(2, "completed", True),
        StaticEvidenceSnapshot(0, "unavailable", True),
    )
    assert metrics.overall_score == 0
    assert metrics.efficiency_score == 0
```

- [ ] **Step 2: Run the focused tests and verify contract failures**

Run: `python -m pytest tests/test_static_evidence.py tests/test_scoring.py tests/test_reports.py -q`

Expected: FAIL because `SyntaxValidation`, `StaticEvidenceSnapshot`, `score_static_strategy`, and the new report fields do not exist.

- [ ] **Step 3: Add exact evidence contracts and helpers**

Add to `backend/app/schemas.py`:

```python
EvaluationKind = Literal["benchmark_full", "upload_static"]
ScoreBasis = Literal["full", "static_only"]


class SyntaxValidation(StrictModel):
    status: Literal["completed", "failed"]
    valid: bool
    line: int | None = Field(default=None, ge=1)
    column: int | None = Field(default=None, ge=1)
    message: str = Field(max_length=1000)
```

Extend `StrategyMetrics` with `score_basis: ScoreBasis = "full"` and change `functionality_score` to `float | None = Field(default=None, ge=0, le=100)`. Add `repaired_syntax: SyntaxValidation | None = None` to `StrategyResult`. Add `evaluation_kind: EvaluationKind = "benchmark_full"` and `baseline_syntax: SyntaxValidation | None = None` to `RunReport`. Defaults keep stored benchmark reports readable.

Create `backend/app/static_evidence.py`:

```python
import ast

from app.schemas import SyntaxValidation, TestExecution


def validate_python_syntax(source: str) -> SyntaxValidation:
    try:
        ast.parse(source, filename="uploaded_code.py", mode="exec")
    except SyntaxError as exc:
        return SyntaxValidation(
            status="failed",
            valid=False,
            line=max(1, exc.lineno or 1),
            column=max(1, exc.offset or 1),
            message=str(exc.msg)[:1000],
        )
    return SyntaxValidation(
        status="completed", valid=True, line=None, column=None, message="Syntax valid."
    )


def unavailable_functional_tests() -> TestExecution:
    return TestExecution(
        status="unavailable",
        passed=0,
        failed=0,
        skipped=0,
        duration_ms=0,
        output="Functional tests unavailable — uploaded code was not executed.",
        output_truncated=False,
    )
```

- [ ] **Step 4: Implement deterministic static scoring and mode-aware ranking eligibility**

Add to `backend/app/scoring.py`:

```python
@dataclass(frozen=True)
class StaticEvidenceSnapshot:
    findings_count: int
    scan_status: ToolStatus
    syntax_valid: bool
    cost_usd: float = 0
    latency_ms: int = 0


def score_static_strategy(
    baseline: StaticEvidenceSnapshot,
    repaired: StaticEvidenceSnapshot,
) -> StrategyMetrics:
    if (
        baseline.scan_status != "completed"
        or repaired.scan_status != "completed"
        or not baseline.syntax_valid
        or not repaired.syntax_valid
    ):
        return StrategyMetrics(
            score_basis="static_only",
            findings_before=baseline.findings_count,
            findings_after=repaired.findings_count,
            fixed_count=0,
            security_score=0,
            functionality_score=None,
            overall_score=0,
            efficiency_score=0,
        )
    fixed = max(0, baseline.findings_count - repaired.findings_count)
    security = (
        100 if baseline.findings_count == repaired.findings_count == 0
        else 100 * fixed / max(1, baseline.findings_count)
    )
    efficiency = (security / 100) / max(repaired.cost_usd, 0.01)
    return StrategyMetrics(
        score_basis="static_only",
        findings_before=baseline.findings_count,
        findings_after=repaired.findings_count,
        fixed_count=fixed,
        security_score=_rounded(security),
        functionality_score=None,
        overall_score=_rounded(security),
        efficiency_score=_rounded(efficiency),
    )
```

Update `build_report(...)` to accept `evaluation_kind: EvaluationKind = "benchmark_full"` and `baseline_syntax: SyntaxValidation | None = None`. Benchmark eligibility continues to require completed functional tests. Upload eligibility requires valid repaired syntax plus completed repaired scanning, but does not require tests. Pass mode-specific limitations and metric-policy copy instead of appending the benchmark formula to upload reports.

- [ ] **Step 5: Run focused tests**

Run: `python -m pytest tests/test_static_evidence.py tests/test_scoring.py tests/test_reports.py tests/test_result_persistence.py -q`

Expected: PASS; stored benchmark reports remain valid through schema defaults.

- [ ] **Step 6: Commit**

```text
feat: add static upload evidence and scoring
```

---

### Task 2: Isolate shared runner lifecycle helpers

**Files:**
- Create: `backend/app/runner_support.py`
- Modify: `backend/app/runner.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_benchmark_pipeline.py`
- Test: `backend/tests/test_run_lifecycle.py`

**Interfaces:**
- Produces: `RunnerDependencies` with `artifact_store: ArtifactStore`
- Produces: `progress_payload`, `combined_scan_status`, `set_stage`, `fail_run`, `run_cancelled`, and `cleanup_run`
- Preserves: `execute_baseline(...)` and `execute_repairs(...)` benchmark behavior

- [ ] **Step 1: Add a regression assertion for unchanged benchmark behavior**

Extend `test_benchmark_run_completes_with_real_evidence`:

```python
assert report["evaluation_kind"] == "benchmark_full"
assert report["baseline_syntax"] is None
assert report["strategy_results"][0]["metrics"]["score_basis"] == "full"
```

- [ ] **Step 2: Run the benchmark regression**

Run: `python -m pytest tests/test_benchmark_pipeline.py tests/test_run_lifecycle.py -q`

Expected: PASS before the refactor; this establishes the behavior that must remain unchanged.

- [ ] **Step 3: Move shared lifecycle code without changing behavior**

Create `backend/app/runner_support.py` and move the existing `RunnerDependencies`, `_now`, `_progress`, `_scan_status`, `_set_stage`, `_fail`, and `_cancelled` behavior into public names:

```python
@dataclass(frozen=True)
class RunnerDependencies:
    fixture_root: Path
    work_root: Path
    tool_timeout_seconds: float
    llm_client: LlmClient
    artifact_store: ArtifactStore


def cleanup_run(dependencies: RunnerDependencies, run_id: str) -> None:
    shutil.rmtree(dependencies.work_root / run_id, ignore_errors=True)
```

Update `backend/app/runner.py` imports and call sites only. In `create_app`, pass the already-created `artifact_store` into `RunnerDependencies`. Keep all benchmark stage names and persistence unchanged.

- [ ] **Step 4: Run benchmark and lifecycle tests after the refactor**

Run: `python -m pytest tests/test_benchmark_pipeline.py tests/test_run_lifecycle.py tests/test_toolchain.py -q`

Expected: PASS with the same T-01 findings, tests, winners, cancellation, and cleanup.

- [ ] **Step 5: Commit**

```text
refactor: share run lifecycle helpers
```

---

### Task 3: Materialize exactly one uploaded Python source safely

**Files:**
- Create: `backend/app/upload_source.py`
- Create: `backend/tests/test_upload_source.py`
- Modify: `backend/app/uploads/store.py`

**Interfaces:**
- Produces: `ArtifactStore.copy_single_python_source(upload_id: str, destination: Path) -> Path`
- Produces: `load_uploaded_python(store: ArtifactStore, upload_id: str, destination: Path) -> tuple[Path, str]`
- Rejects: missing artifacts, multiple files, non-`.py` source, invalid UTF-8, and paths outside the artifact root

- [ ] **Step 1: Write failing materialization tests**

```python
@pytest.fixture
def artifact_store(tmp_path: Path) -> ArtifactStore:
    return ArtifactStore(tmp_path / "artifacts")


def test_load_uploaded_python_copies_one_file_without_importing(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    source = validate_source(
        "audit.py",
        b"raise RuntimeError('must never execute')\n",
        UploadPolicy(),
    )
    artifact = artifact_store.store(source, UploadPurpose.UPLOADED_CODE)
    output, text = load_uploaded_python(
        artifact_store, artifact.upload_id, tmp_path / "work" / "source"
    )
    assert output.name == "audit.py"
    assert "must never execute" in text


def test_load_uploaded_python_rejects_multi_file_archive(
    artifact_store: ArtifactStore, tmp_path: Path
) -> None:
    source = ValidatedSource(
        files=(
            ValidatedFile("one.py", b"x = 1\n"),
            ValidatedFile("two.py", b"x = 2\n"),
        ),
        total_bytes=12,
        manifest_json="{}",
        content_hash="sha256:" + "0" * 64,
    )
    artifact = artifact_store.store(source, UploadPurpose.UPLOADED_CODE)
    with pytest.raises(UploadSourceError, match="single_python_file_required"):
        load_uploaded_python(
            artifact_store, artifact.upload_id, tmp_path / "work" / "source"
        )
```

- [ ] **Step 2: Run the tests and verify missing loader failures**

Run: `python -m pytest tests/test_upload_source.py -q`

Expected: FAIL because `copy_single_python_source`, `load_uploaded_python`, and `UploadSourceError` do not exist.

- [ ] **Step 3: Implement bounded copy and load functions**

Add to `ArtifactStore`:

```python
def copy_single_python_source(self, upload_id: str, destination: Path) -> Path:
    source_root = self.source_path(upload_id).resolve()
    files = [item for item in source_root.rglob("*") if item.is_file()]
    if len(files) != 1 or files[0].suffix.lower() != ".py":
        raise ValueError("single_python_file_required")
    source_file = files[0].resolve()
    if not source_file.is_relative_to(source_root):
        raise ValueError("artifact_path_escape")
    destination.mkdir(parents=True, exist_ok=False)
    output = destination / source_file.name
    shutil.copyfile(source_file, output)
    return output
```

Wrap store errors in `UploadSourceError` inside `load_uploaded_python`, decode copied bytes strictly as UTF-8, and return the copied path plus text. Do not call `compile`, `exec`, `eval`, `importlib`, `subprocess`, or the Pytest adapter.

- [ ] **Step 4: Run artifact and upload-source tests**

Run: `python -m pytest tests/test_upload_source.py tests/test_artifact_store.py tests/test_upload_validation.py -q`

Expected: PASS.

- [ ] **Step 5: Commit**

```text
feat: safely materialize uploaded python source
```

---

### Task 4: Execute and persist the static upload pipeline

**Files:**
- Create: `backend/app/upload_runner.py`
- Create: `backend/tests/test_upload_pipeline.py`
- Modify: `backend/app/repairs.py`
- Modify: `backend/app/runner.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/reports.py`
- Modify: `backend/tests/test_repairs.py`

**Interfaces:**
- Produces: `execute_upload_baseline(run_id, session_factory, dependencies) -> None`
- Produces: `execute_upload_repairs(run_id, session_factory, dependencies) -> None`
- Produces: `execute_run_baseline(...)` and `execute_run_repairs(...)` mode dispatchers
- Consumes: syntax/static evidence and safe source loader from Tasks 1 and 3

- [ ] **Step 1: Write a failing end-to-end upload pipeline test**

```python
def test_upload_run_completes_with_real_static_evidence(
    client: TestClient,
) -> None:
    source = (
        b'import sqlite3\n\n'
        b'def lookup(connection, username):\n'
        b'    query = f"SELECT id, username, role FROM users WHERE username = '
        b"'{username}'\"\n"
        b'    return connection.execute(query).fetchone()\n'
    )
    upload = client.post(
        "/api/v1/uploads",
        files={"source": ("audit.py", source, "text/x-python")},
        data={"purpose": "uploaded_code"},
    ).json()
    created = client.post(
        "/api/v1/runs",
        json={
            "mode": "upload",
            "upload_id": upload["upload_id"],
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    ).json()
    run_id = created["run_id"]
    assert client.post(f"/api/v1/runs/{run_id}/start").status_code == 200
    assert client.get(f"/api/v1/runs/{run_id}/progress").json()["stage"] == "awaiting_strategy"
    assert client.post(
        f"/api/v1/runs/{run_id}/strategies",
        json={"strategies": ["scanner_feedback_v1"]},
    ).status_code == 200
    report = client.get(f"/api/v1/runs/{run_id}/report").json()
    assert report["mode"] == "upload"
    assert report["evaluation_kind"] == "upload_static"
    assert report["baseline_syntax"]["valid"] is True
    assert report["baseline_tests"]["status"] == "unavailable"
    assert {item["scanner"] for item in report["baseline_findings"]} >= {"bandit", "semgrep"}
    result = report["strategy_results"][0]
    assert result["repaired_syntax"]["valid"] is True
    assert result["repaired_tests"]["status"] == "unavailable"
    assert result["repaired_findings"] == []
    assert result["metrics"]["score_basis"] == "static_only"
    assert report["best_overall"] == "scanner_feedback_v1"
```

- [ ] **Step 2: Prove uploaded tests/source are never executed**

Add a test that monkeypatches `app.tools.pytest_runner.run_pytest` with a function that raises immediately if referenced, and uses uploaded source containing a top-level `raise RuntimeError`. The upload run must still reach `awaiting_strategy`. In a separate adapter-boundary test, replace `upload_runner.run_bandit` and `upload_runner.run_semgrep` with capturing fakes and assert their trusted source-directory arguments are the only analysis calls made with the materialized path.

- [ ] **Step 3: Run upload pipeline tests and verify mode-dispatch failure**

Run: `python -m pytest tests/test_upload_pipeline.py -q`

Expected: FAIL because start currently dispatches every run to the T-01 benchmark fixture.

- [ ] **Step 4: Implement upload baseline execution**

`execute_upload_baseline` must:

1. Load the persisted upload ID and category set.
2. Copy exactly one `.py` file into `<work_root>/<run_id>/baseline/source`.
3. Call `validate_python_syntax`; on invalid syntax, call `fail_run(..., "invalid_python_syntax", message)` and clean up.
4. Persist `baseline_testing` as completed with `unavailable_functional_tests()` without calling Pytest.
5. Run Bandit and Semgrep against the copied source directory.
6. Require completed scanner statuses, filter findings by selected categories, store syntax/source/findings/scanner/test evidence in progress, and transition to `awaiting_strategy`.

- [ ] **Step 5: Implement upload repair execution**

For every selected strategy, copy the baseline source into a fresh attempt directory, call `repair_source` with unavailable test evidence, write only the validated bounded repair text, validate repaired syntax, run Bandit/Semgrep, compute `score_static_strategy`, and build a `StrategyResult` with:

```python
StrategyResult(
    attempt_id=attempt_id,
    strategy_id=strategy_id,
    status=JobStatus.COMPLETED,
    repaired_code=repair.value.repaired_code,
    repair_summary=repair.value.summary,
    limitations=repair.value.limitations,
    repaired_findings=repaired_findings,
    repaired_scan_status=scan_status,
    repaired_syntax=repaired_syntax,
    repaired_tests=unavailable_functional_tests(),
    llm_usage=usage,
    review=(
        "The candidate passed syntax validation and was rescanned. "
        "Uploaded code was not executed; this is not a security guarantee."
    ),
    metrics=metrics,
)
```

Build the report with `evaluation_kind="upload_static"`, upload-specific explanation/limitations, and no benchmark metric-policy text.

- [ ] **Step 6: Dispatch start and strategy execution by persisted mode**

Add `execute_run_baseline` and `execute_run_repairs` in `backend/app/runner.py`. Read `RunRecord.mode` once and dispatch `benchmark` to the existing functions, `upload` to `upload_runner`, and fail `custom_prompt` with `unsupported_mode` until its later slice. Update `backend/app/main.py` background tasks to call only these dispatchers.

- [ ] **Step 7: Generalize deterministic SQL fallback copy**

Keep the bounded SQL transformation already used by T-01, but change its limitation from fixture-only wording to: `The local fallback recognizes only the demonstrated SQL interpolation pattern.` Add a repair test using filename-independent uploaded source and unavailable functional-test evidence. Unknown patterns must still return explicit failed repair status.

- [ ] **Step 8: Run backend upload and benchmark regression suites**

Run: `python -m pytest tests/test_upload_pipeline.py tests/test_benchmark_pipeline.py tests/test_repairs.py tests/test_result_persistence.py tests/test_run_lifecycle.py -q`

Expected: PASS; benchmark reports and winners remain unchanged.

- [ ] **Step 9: Commit**

```text
feat: execute real static upload analysis
```

---

### Task 5: Generalize the live frontend run controller

**Files:**
- Rename: `frontend/src/useLiveBenchmark.ts` to `frontend/src/useLiveRun.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/contracts/api-v1.ts`
- Modify: `frontend/src/api/report-response.contract-test.ts`
- Create: `frontend/src/api/upload-report.contract-test.ts`

**Interfaces:**
- Produces: `useLiveRun(initialRunId, initialRequested)`
- Produces: `startBenchmark(taskId, scanCategories)`
- Produces: `startUpload(sourceCode, fileName, scanCategories)`
- Preserves: bounded retry, stale-response protection, start reconciliation, configuration, cancellation, reset, and refresh report loading

- [ ] **Step 1: Add failing TypeScript upload-report and controller contracts**

Create a compile-time fixture satisfying `RunReport` with:

```typescript
const uploadReport = {
  schema_version: "1.0",
  run_id: "run_00000000000000000000000000000000",
  status: "completed",
  mode: "upload",
  evaluation_kind: "upload_static",
  baseline_source: "print('uploaded')\n",
  baseline_syntax: {
    status: "completed",
    valid: true,
    line: null,
    column: null,
    message: "Syntax valid.",
  },
  baseline_findings: [],
  baseline_scan_status: "completed",
  baseline_tests: {
    status: "unavailable",
    passed: 0,
    failed: 0,
    skipped: 0,
    duration_ms: 0,
    output: "Functional tests unavailable — uploaded code was not executed.",
    output_truncated: false,
  },
  // include one complete static-only StrategyResult and existing report fields
} as const satisfies RunReport;
```

Update the existing controller contract/import expectations to require `useLiveRun` and both start methods.

- [ ] **Step 2: Run TypeScript and verify missing contract fields**

Run: `corepack pnpm exec tsc --noEmit`

Expected: FAIL because evaluation/syntax/static score fields and upload start behavior are absent.

- [ ] **Step 3: Extend TypeScript contracts exactly to match Pydantic**

Add `SyntaxValidation`, `EvaluationKind`, and `ScoreBasis`; make `functionality_score: number | null`; add the new report/result fields with the same required/nullability rules as Task 1.

- [ ] **Step 4: Rename and generalize the hook**

Extract shared `createAndStart(payload: RunCreate)` logic so both starts receive the same reconciliation behavior. Implement upload start as:

```typescript
async function startUpload(
  sourceCode: string,
  fileName: string,
  scanCategories: ScanCategoryId[],
) {
  const safeName = fileName.toLowerCase().endsWith(".py") ? fileName : "uploaded_code.py";
  const source = new File([sourceCode], safeName, { type: "text/x-python" });
  const receipt = await client.uploadSource(source, "uploaded_code");
  return createAndStart({
    mode: "upload",
    upload_id: receipt.upload_id,
    scan_categories: scanCategories,
    strategies: ["vulnerability_specific_v1"],
  });
}
```

Do not persist the upload receipt or report body in local storage; persist only the existing run ID/navigation state.

- [ ] **Step 5: Route Upload Code into live state**

In `App.tsx`, replace `isLiveBenchmark` with `isLiveRun` covering `(benchmark && T-01) || mode === "upload"` when `live.requested`. After scan selection, call `startUpload(uploadedCode, uploadMeta?.fileName || "uploaded_code.py", scans)` for upload mode. Keep other benchmark tasks and Custom Prompt on their current demo paths.

- [ ] **Step 6: Run TypeScript**

Run: `corepack pnpm exec tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

```text
feat: connect upload mode to live run state
```

---

### Task 6: Render mode-aware upload evidence in the Figma screens

**Files:**
- Modify: `frontend/src/LiveScreens.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/scripts/verify-responsive-layout.mjs`

**Interfaces:**
- Consumes: `RunReport.evaluation_kind`, syntax fields, scanner status, unavailable tests, static-only metrics
- Preserves: existing component layout, colors, typography, action labels, responsive behavior, and benchmark rendering

- [ ] **Step 1: Add failing visible-state assertions to the browser workflow planned in Task 7**

Assertions must require exact visible copy:

```text
Exploratory upload analysis
Syntax valid
Functional tests unavailable — uploaded code was not executed.
Static-only score
Bandit · B608
Semgrep · secureeval.python.sql-injection
```

Expected before implementation: FAIL because upload screens still render deterministic demo fixtures.

- [ ] **Step 2: Make live screens mode-aware without redesigning them**

Pass `mode` or derive it from `report.mode`. For upload baseline/comparison/results:

- Replace benchmark/T-01 eyebrow copy with `Exploratory upload analysis`.
- Display baseline and repaired syntax status.
- Render the exact unavailable functional-test message from the backend.
- Label `overall_score` as `Static-only score` and hide functionality percentage.
- Keep scanner findings, token/cost/latency, best overall/efficiency, explanation source, limitations, and source code from the persisted report.
- If syntax or scanners are unavailable, display unavailable status and do not imply a winner.
- Preserve the explicit statement that static analysis is not a security guarantee.

- [ ] **Step 3: Correct upload-mode pre-analysis copy**

Update existing Upload Code copy from `Files stay in this browser` to explain that code is sent only to the local SecureEval backend for static analysis and is never executed. Replace filename-only test-file confidence with: `Provided tests are recorded as context only and are not uploaded or executed in this safe static-analysis slice.`

- [ ] **Step 4: Run type and responsive checks**

Run: `corepack pnpm exec tsc --noEmit`

Run: `corepack pnpm verify:responsive`

Expected: PASS at 390px and 1440px; existing benchmark fixture routes still render correctly when no live run ID exists.

- [ ] **Step 5: Commit**

```text
feat: show real static upload evidence
```

---

### Task 7: Verify the real Upload Code workflow in a browser

**Files:**
- Create: `frontend/scripts/verify-real-upload.mjs`
- Modify: `frontend/package.json`
- Modify: `README.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

**Interfaces:**
- Produces: `corepack pnpm verify:real-upload`
- Verifies: local upload, syntax validation, real scanners, repair/rescan, unavailable functional tests, persistence, refresh, and failure state

- [ ] **Step 1: Write the failing Playwright workflow**

Copy only the temporary server lifecycle pattern from `verify-real-benchmark.mjs`. Drive the UI through Upload Code using the known vulnerable SQL sample, select Injection, choose Scanner Feedback, and assert the exact copy listed in Task 6. Record the winner, reload, and require the same persisted report/winner.

Add two negative paths:

1. Paste invalid Python and require a visible terminal syntax error with navigation back to edit/replace source.
2. Abort the upload API request and require a visible API error with no `Demo analysis complete` fallback.

- [ ] **Step 2: Run the browser script and verify the old demo path fails**

Run: `node scripts/verify-real-upload.mjs`

Expected: FAIL before Tasks 5–6 because Upload Code does not create a backend artifact/run.

- [ ] **Step 3: Add the package script and concise documentation**

Add:

```json
"verify:real-upload": "node scripts/verify-real-upload.mjs"
```

Document that Upload Code performs real local syntax/static analysis and repair but never executes uploaded code/tests. Keep T-01 documented as the only mode with real Pytest functional execution.

- [ ] **Step 4: Run all frontend verification**

Run: `corepack pnpm exec tsc --noEmit`

Run: `corepack pnpm build`

Run: `corepack pnpm verify:responsive`

Run: `corepack pnpm verify:real-benchmark`

Run: `corepack pnpm verify:real-upload`

Expected: all PASS, including refresh and explicit failure states.

- [ ] **Step 5: Commit**

```text
test: verify real upload analysis workflow
```

---

### Task 8: Final safety and regression verification

**Files:**
- Modify only if a verification failure requires a focused fix

**Interfaces:**
- Produces: merge-ready evidence for the complete upload slice

- [ ] **Step 1: Run the full backend suite without unavailable Docker checks**

Run: `python -m pytest -m "not docker_live"`

Expected: all tests PASS; the three Docker-only tests are deselected.

- [ ] **Step 2: Run the complete frontend suite**

Run: `corepack pnpm exec tsc --noEmit`

Run: `corepack pnpm verify:responsive`

Run: `corepack pnpm verify:real-benchmark`

Run: `corepack pnpm verify:real-upload`

Expected: all PASS.

- [ ] **Step 3: Conduct the focused non-execution review**

Search upload-runner changes for `exec(`, `eval(`, `compile(`, `importlib`, `run_pytest`, and subprocess calls. Confirm no uploaded source path reaches anything except `ast.parse`, trusted file copying, Bandit, Semgrep, bounded repair construction, and report persistence. Confirm no source body appears in logs or error messages.

- [ ] **Step 4: Conduct the evidence-label review**

Confirm every uploaded result is `upload_static`, every functional-test display is unavailable, static winners require valid syntax and completed scanners, scanner failures never appear as zero findings, and benchmark behavior/labels are unchanged.

- [ ] **Step 5: Run diff hygiene checks**

Run: `git diff --check`

Expected: no whitespace errors, secrets, generated databases, artifact directories, or browser output committed.

- [ ] **Step 6: Commit any focused verification fix**

If Step 1–5 required a code correction, use a narrow commit named:

```text
fix: close upload verification gap
```

If no correction was required, do not create an empty commit.
