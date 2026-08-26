# Real Benchmark Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one complete benchmark run whose scans, tests, repair, metrics, report, persistence, and frontend display come from the FastAPI backend rather than fixtures or UI timers.

**Architecture:** Extend the existing FastAPI monolith with focused tool adapters and a synchronous per-run worker launched in a background thread. The worker operates on a controlled fixture, persists each stage in SQLite, and exposes progress/report data through the existing typed client; React polls those endpoints and preserves the Figma layout.

**Tech Stack:** React 19, TypeScript 5.7, FastAPI, Python 3.14, SQLAlchemy, SQLite, Pydantic 2, Pytest, Bandit, Semgrep, Pandas, HTTPX, Alembic

**Spec:** `docs/superpowers/specs/2026-08-27-functional-full-stack-recovery-design.md`

## Global Constraints

- Preserve the supplied Figma UI; replace behavior and data plumbing without redesigning screens.
- Bandit, Semgrep, and Pytest must process a controlled local Python fixture in this slice.
- The LLM adapter uses `SECUREEVAL_LLM_BASE_URL`, `SECUREEVAL_LLM_API_KEY`, and `SECUREEVAL_LLM_MODEL`; no secret reaches logs, SQLite, or frontend responses.
- Without an API key, use a deterministic repair and explanation labeled `local_fallback`.
- Python calculates all tests, metrics, rankings, cost totals, and latency totals.
- Do not add queues, cloud services, authentication, deployment, or production infrastructure.
- Every subprocess has a timeout, bounded output, explicit working directory, and structured failure result.

---

### Task 1: Lock the functional toolchain and fixture contract

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/pylock.toml`
- Modify: `backend/.env.example`
- Create: `backend/tests/test_toolchain.py`
- Create: `backend/app/fixtures/benchmark_t01/source/app.py`
- Create: `backend/app/fixtures/benchmark_t01/tests/test_app.py`
- Create: `backend/app/fixtures/benchmark_t01/fixture.json`

**Interfaces:**
- Produces fixture manifest fields `task_id`, `entrypoint`, `test_path`, and `expected_rule_ids`.
- Produces installed commands `bandit`, `semgrep`, and `pytest` plus runtime libraries `pandas` and `httpx`.

- [ ] **Step 1: Write the failing toolchain test**

```python
import importlib.util
import shutil
from pathlib import Path


def test_real_analysis_toolchain_and_fixture_exist():
    root = Path(__file__).parents[1]
    assert shutil.which("bandit")
    assert shutil.which("semgrep")
    assert importlib.util.find_spec("pandas")
    assert importlib.util.find_spec("httpx")
    assert (root / "app/fixtures/benchmark_t01/source/app.py").is_file()
    assert (root / "app/fixtures/benchmark_t01/tests/test_app.py").is_file()
```

- [ ] **Step 2: Run the test and confirm the missing dependencies/fixture failure**

Run: `python -m pytest tests/test_toolchain.py -v`

Expected: FAIL because the scanner commands and fixture do not yet exist.

- [ ] **Step 3: Add and lock compatible dependencies**

Add Bandit, Semgrep, Pandas, and HTTPX as runtime dependencies and ensure Pytest is available to the worker. Resolve exact Python 3.14-compatible versions into `backend/pylock.toml`; do not guess versions that the resolver rejects.

Add these non-secret settings to `.env.example`:

```dotenv
SECUREEVAL_LLM_BASE_URL=https://api.openai.com/v1
SECUREEVAL_LLM_API_KEY=
SECUREEVAL_LLM_MODEL=
SECUREEVAL_TOOL_TIMEOUT_SECONDS=30
```

- [ ] **Step 4: Add the controlled vulnerable fixture**

Create a small SQL lookup function that passes its functional tests but uses string interpolation in a SQL query. `fixture.json` identifies it as `T-01` and records the expected Bandit/Semgrep SQL-injection rule families. Tests exercise valid lookup behavior without making network calls.

- [ ] **Step 5: Install from the lock and rerun the test**

Run: `python -m pip install -e ".[test]"`

Run: `python -m pytest tests/test_toolchain.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: add real analysis toolchain and benchmark fixture
```

---

### Task 2: Persist real analysis and report data

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`
- Create: `backend/app/reports.py`
- Create: `backend/migrations/versions/0003_functional_results.py`
- Create: `backend/tests/test_result_persistence.py`

**Interfaces:**
- Produces SQLAlchemy records `FindingRecord`, `TestExecutionRecord`, `LlmCallRecord`, and `RunReportRecord`.
- Produces Pydantic types `Finding`, `TestExecution`, `LlmUsage`, `StrategyResult`, `RunProgress`, and `RunReport`.
- `RunReport` contains baseline findings/tests, strategy results, `best_overall`, `best_efficiency`, explanation, and explanation source.
- Produces `save_report(session: Session, report: RunReport) -> None` and `load_report(session: Session, run_id: str) -> RunReport` in `backend/app/reports.py`.

- [ ] **Step 1: Write a failing migration/persistence test**

```python
def test_report_survives_new_database_session(session_factory, completed_report):
    with session_factory() as session:
        save_report(session, completed_report)
    with session_factory() as restarted_session:
        restored = load_report(restarted_session, completed_report.run_id)
    assert restored.run_id == completed_report.run_id
    assert restored.baseline_findings
```

- [ ] **Step 2: Run the focused test and verify the missing schema/route failure**

Run: `python -m pytest tests/test_result_persistence.py -v`

Expected: FAIL because result tables, report response types, and persistence functions do not exist.

- [ ] **Step 3: Add normalized tables and relationships**

Store scanner, rule ID, severity, confidence, filename, line, message, and stage for findings. Store command status, passed/failed/skipped counts, duration, and bounded output for tests. Store provider, model, source, token counts, estimated cost, latency, retries, and response status for LLM calls. Store the final report JSON plus deterministic winners on the run report.

- [ ] **Step 4: Add strict Pydantic response contracts**

Use enums/literals for stages and statuses. Mark unavailable functional verification explicitly; never encode it as a passing test result.

- [ ] **Step 5: Apply migrations and rerun persistence tests**

Run: `python -m pytest tests/test_migrations.py tests/test_result_persistence.py -v`

Expected: PASS, including restart persistence.

- [ ] **Step 6: Commit**

```text
feat: persist analysis findings tests and reports
```

---

### Task 3: Run and normalize Pytest, Bandit, and Semgrep

**Files:**
- Create: `backend/app/tools/__init__.py`
- Create: `backend/app/tools/process.py`
- Create: `backend/app/tools/bandit.py`
- Create: `backend/app/tools/semgrep.py`
- Create: `backend/app/tools/pytest_runner.py`
- Create: `backend/config/semgrep-python.yml`
- Create: `backend/tests/test_tool_adapters.py`

**Interfaces:**
- Produces `run_command(arguments: list[str], cwd: Path, timeout_seconds: float, environment: Mapping[str, str] | None = None) -> ProcessResult`.
- Produces `run_bandit(source: Path, timeout_seconds: float) -> ScanResult`.
- Produces `run_semgrep(source: Path, timeout_seconds: float) -> ScanResult`.
- Produces `run_pytest(tests: Path, source: Path, timeout_seconds: float) -> TestResult`.

- [ ] **Step 1: Write failing adapter tests against the controlled fixture**

```python
def test_real_scanners_find_fixture_sql_injection(benchmark_fixture):
    bandit = run_bandit(benchmark_fixture.source, 30)
    semgrep = run_semgrep(benchmark_fixture.source, 30)
    assert bandit.status == "completed"
    assert semgrep.status == "completed"
    assert any("sql" in item.message.lower() for item in bandit.findings + semgrep.findings)


def test_fixture_functionality_passes_before_repair(benchmark_fixture):
    result = run_pytest(benchmark_fixture.tests, benchmark_fixture.source, 30)
    assert result.status == "completed"
    assert result.failed == 0
    assert result.passed > 0
```

- [ ] **Step 2: Run tests and verify import failures**

Run: `python -m pytest tests/test_tool_adapters.py -v`

Expected: FAIL because tool adapters do not exist.

- [ ] **Step 3: Implement the bounded process adapter**

Use `subprocess.run` with argument arrays, `shell=False`, an explicit resolved `cwd`, UTF-8 decoding, `capture_output=True`, and timeout handling. Truncate combined output to 64 KiB and return structured `completed`, `failed`, `timeout`, or `unavailable` status.

- [ ] **Step 4: Implement JSON normalization**

Run Bandit with recursive JSON output and Semgrep with local Python security rules plus JSON output. Normalize paths relative to the work directory. Run Pytest with a small local plugin or report parser that returns exact pass/fail/skip counts.

- [ ] **Step 5: Run adapter tests**

Run: `python -m pytest tests/test_tool_adapters.py -v`

Expected: PASS with findings from both real scanners and passing baseline functional tests.

- [ ] **Step 6: Commit**

```text
feat: execute and normalize security tools
```

---

### Task 4: Add structured LLM repair and honest fallback

**Files:**
- Create: `backend/app/llm/__init__.py`
- Create: `backend/app/llm/contracts.py`
- Create: `backend/app/llm/client.py`
- Create: `backend/app/repairs.py`
- Create: `backend/tests/test_llm_client.py`
- Create: `backend/tests/test_repairs.py`

**Interfaces:**
- Produces `RepairProposal` with `repaired_code`, `summary`, and `limitations`.
- Produces `ExplanationResponse` with `explanation` and `limitations`.
- Produces `LlmResult[T]` with validated value, source, provider/model, tokens, cost, latency, retries, and status.
- Produces `LlmClient.complete(response_type: type[T], messages: list[dict[str, str]]) -> LlmResult[T]`.
- Produces `repair_source(strategy_id, source, findings, test_result, llm_client) -> LlmResult[RepairProposal]`.

- [ ] **Step 1: Write failing contract, provider, and fallback tests**

```python
def test_invalid_provider_json_is_retried_then_fails(fake_http):
    fake_http.respond_json({"choices": [{"message": {"content": "not-json"}}]})
    result = client.complete(RepairProposal, messages=[])
    assert result.status == "invalid_response"
    assert result.retries == 1


def test_missing_key_returns_labeled_deterministic_repair(vulnerable_source):
    result = fallback_client.repair("vulnerability_specific", vulnerable_source, findings=[])
    assert result.source == "local_fallback"
    assert "?" in result.value.repaired_code
    assert "%" not in result.value.repaired_code
```

- [ ] **Step 2: Run tests and verify missing implementation**

Run: `python -m pytest tests/test_llm_client.py tests/test_repairs.py -v`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement the OpenAI-compatible client**

POST to `{base_url}/chat/completions` with bearer authentication, bounded timeout, one retry, structured JSON instructions, and a response token limit. Parse token usage when present, estimate cost only from configured input/output price environment variables, and validate content with Pydantic.

- [ ] **Step 4: Implement strategy prompts and fallback**

Send only the fixture source, normalized findings, relevant test result, and one strategy instruction. For `T-01`, fallback replaces interpolated SQL with a parameterized query and supplies a concise labeled explanation. Validate that repaired output is Python text of bounded size before writing it.

- [ ] **Step 5: Run LLM and repair tests**

Run: `python -m pytest tests/test_llm_client.py tests/test_repairs.py -v`

Expected: PASS without a real API key; HTTP behavior is tested with an injected fake transport.

- [ ] **Step 6: Commit**

```text
feat: add structured llm repairs and fallback
```

---

### Task 5: Calculate deterministic scores and build reports

**Files:**
- Create: `backend/app/scoring.py`
- Modify: `backend/app/reports.py`
- Create: `backend/tests/test_scoring.py`
- Create: `backend/tests/test_reports.py`

**Interfaces:**
- Produces `score_strategy(baseline, repaired) -> StrategyMetrics`.
- Produces `rank_strategies(metrics: list[StrategyMetrics]) -> Ranking`.
- Produces `build_report(run, baseline, attempts, explanation) -> RunReport`.

- [ ] **Step 1: Write failing deterministic scoring tests**

```python
def test_zero_findings_and_preserved_tests_win_over_regression():
    secure = metrics("scanner_feedback", findings=0, passed=12, failed=0, cost=0.02, latency=3)
    regressed = metrics("test_feedback", findings=0, passed=9, failed=3, cost=0.01, latency=2)
    ranking = rank_strategies([regressed, secure])
    assert ranking.best_overall == "scanner_feedback"
    assert ranking.best_efficiency in {"scanner_feedback", "test_feedback"}


def test_rankings_do_not_depend_on_llm_text():
    first = score_strategy(baseline(), repaired(explanation="A"))
    second = score_strategy(baseline(), repaired(explanation="B"))
    assert first == second
```

- [ ] **Step 2: Run tests and verify missing functions**

Run: `python -m pytest tests/test_scoring.py tests/test_reports.py -v`

Expected: FAIL because scoring/report builders do not exist.

- [ ] **Step 3: Implement pure deterministic calculations**

Calculate vulnerability reduction, functional preservation, overall score, and efficiency from persisted numerical inputs. Use Pandas only to assemble/compare the small strategy table; convert results back to validated Pydantic types before persistence.

- [ ] **Step 4: Implement report construction**

Include raw evidence, exact formulas/inputs, unavailable states, LLM source labels, limitations, and winners. Never infer a pass when a tool did not run.

- [ ] **Step 5: Run scoring/report tests**

Run: `python -m pytest tests/test_scoring.py tests/test_reports.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: calculate deterministic repair rankings
```

---

### Task 6: Orchestrate and expose one complete benchmark run

**Files:**
- Create: `backend/app/runner.py`
- Modify: `backend/app/services.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas.py`
- Create: `backend/tests/test_benchmark_pipeline.py`
- Modify: `backend/tests/test_run_lifecycle.py`

**Interfaces:**
- Produces Pydantic `StrategySelection` with one or more unique strategy identifiers or `run_all`.
- Produces `RunnerDependencies` containing the fixture/work roots, tool timeout, and `LlmClient`.
- Produces `execute_baseline(run_id: str, session_factory: sessionmaker[Session], dependencies: RunnerDependencies) -> None`.
- Produces `execute_repairs(run_id: str, session_factory: sessionmaker[Session], dependencies: RunnerDependencies) -> None`.
- Produces `GET /api/v1/runs/{run_id}/progress -> RunProgress`.
- Produces `GET /api/v1/runs/{run_id}/report -> RunReport`.
- Produces `POST /api/v1/runs/{run_id}/strategies` accepting `StrategySelection` and launching the repair continuation exactly once.
- Changes `POST /runs/{run_id}/start` to launch baseline analysis exactly once and remain idempotently protected by state transitions.

- [ ] **Step 1: Write the failing end-to-end API test**

```python
def test_benchmark_run_completes_with_real_evidence(client, benchmark_run_payload):
    created = client.post("/api/v1/runs", json=benchmark_run_payload).json()
    client.post(f'/api/v1/runs/{created["run_id"]}/start').raise_for_status()
    wait_for_stage(client, created["run_id"], "awaiting_strategy")
    client.post(
        f'/api/v1/runs/{created["run_id"]}/strategies',
        json={"strategies": ["scanner_feedback"]},
    ).raise_for_status()
    report = wait_for_report(client, created["run_id"])
    assert report["status"] == "completed"
    assert {item["scanner"] for item in report["baseline_findings"]} >= {"bandit", "semgrep"}
    assert report["baseline_tests"]["passed"] > 0
    assert report["strategy_results"][0]["repaired_tests"]["failed"] == 0
    assert report["strategy_results"][0]["repaired_findings"] == []
    assert report["best_overall"]
    assert report["explanation_source"] in {"llm", "local_fallback"}
```

- [ ] **Step 2: Run the test and verify missing completion behavior**

Run: `python -m pytest tests/test_benchmark_pipeline.py -v`

Expected: FAIL because starting a run currently stops at `running`.

- [ ] **Step 3: Implement the worker pipeline**

Allow benchmark creation with no repair strategies selected yet. Load only `T-01`, create a unique work directory, run baseline tests/scans, persist evidence, and expose stage `awaiting_strategy`. After the strategy endpoint is called, create attempts, run each selected strategy on a fresh baseline copy, rerun tools, calculate metrics, generate/obtain the explanation, persist the report, and set `completed`. Convert exceptions into structured `failed` state and always remove the work directory after a terminal state.

- [ ] **Step 4: Implement progress/report endpoints and cancellation checks**

Persist stage transitions before each tool/LLM action. Check cancellation between stages. A cancelled run never becomes completed, a second start never launches another baseline worker, and strategies cannot be configured twice.

- [ ] **Step 5: Run lifecycle and pipeline tests**

Run: `python -m pytest tests/test_run_lifecycle.py tests/test_benchmark_pipeline.py tests/test_result_persistence.py -v`

Expected: PASS.

- [ ] **Step 6: Commit**

```text
feat: complete real benchmark evaluation pipeline
```

---

### Task 7: Connect the Figma workflow to real API state

**Files:**
- Modify: `frontend/src/contracts/api-v1.ts`
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/api/report-response.contract-test.ts`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/scripts/verify-real-benchmark.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes `RunProgress` and `RunReport` from Task 6.
- Adds client methods `getProgress(runId)`, `configureStrategies(runId, strategies)`, and `getReport(runId)`.
- Persists only `runId` and navigation inputs in local storage; report content comes from the backend.

- [ ] **Step 1: Add failing response-contract tests**

Create a representative backend report fixture and assert that scanner names, findings, test states, strategy metrics, usage, winners, explanation source, and limitations are accepted by the TypeScript contract.

Run: `corepack pnpm exec tsc --noEmit`

Expected: FAIL because progress/report contracts and client methods do not exist.

- [ ] **Step 2: Add typed contracts and client methods**

Extend the existing client without changing established create/start/cancel methods. Convert non-success API envelopes into the existing `SecureEvalApiError`.

- [ ] **Step 3: Replace benchmark timers and result constants**

Create and start the backend run after scan selection, poll until baseline stage `awaiting_strategy`, then preserve the existing strategy-selection screen. Submit the selected strategies to resume the backend worker, render real stages in Comparison, render `RunReport` in Results, call the cancel endpoint, and resume using the persisted run ID after refresh. Keep explicit loading, empty, failed, and cancelled views.

- [ ] **Step 4: Add the real browser workflow check**

The script starts a temporary backend and Vite preview, selects `T-01`, chooses scans and one repair strategy, waits for completion, verifies that Bandit/Semgrep evidence and persisted winners are visible, reloads the page, and confirms the same report remains visible.

- [ ] **Step 5: Run frontend verification**

Run: `corepack pnpm exec tsc --noEmit`

Run: `corepack pnpm build`

Run: `node scripts/verify-real-benchmark.mjs`

Expected: all PASS; the visible results originate from the backend report.

- [ ] **Step 6: Commit**

```text
feat: connect figma benchmark flow to real results
```

---

### Task 8: Verify and document the working slice

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

**Interfaces:**
- Produces exact local setup commands and explains real-LLM versus fallback behavior.

- [ ] **Step 1: Run the full backend suite**

Run: `python -m pytest`

Expected: PASS.

- [ ] **Step 2: Run frontend regression checks**

Run: `corepack pnpm exec tsc --noEmit`

Run: `corepack pnpm verify:responsive`

Run: `node scripts/verify-real-benchmark.mjs`

Expected: PASS at existing desktop/mobile breakpoints and through the real benchmark flow.

- [ ] **Step 3: Perform focused self-review**

Confirm no API key, absolute artifact path, uploaded source, or unrestricted subprocess command appears in logs/responses. Confirm every displayed numerical result maps to persisted backend evidence and every fallback label is visible.

- [ ] **Step 4: Update concise local setup documentation**

Document backend installation/start, frontend start, scanner prerequisites, supported `T-01` flow, environment variables, fallback labeling, and current limitation that remaining modes are delivered in subsequent slices.

- [ ] **Step 5: Commit**

```text
docs: explain real local benchmark workflow
```
