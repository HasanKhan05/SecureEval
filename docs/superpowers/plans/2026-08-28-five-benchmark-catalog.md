# Five Controlled Benchmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make T-01 through T-05 real controlled benchmark workflows with fixed tests, scanners, repairs, scoring, persistence, and live UI selection.

**Architecture:** A typed registry resolves a persisted benchmark task ID to one repository-controlled fixture. The existing benchmark runner consumes that resolved fixture, and deterministic repair fallbacks are extended only for the five known patterns.

**Tech Stack:** Python 3.14, FastAPI, Pydantic, SQLAlchemy, Pytest, Bandit, Semgrep, React 19, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-five-benchmark-catalog-design.md`

## Global Constraints

- Preserve the Figma layout and existing run lifecycle.
- Only repository-controlled benchmark fixtures may reach Pytest.
- Unknown benchmark IDs fail before execution.
- No new runtime dependency.
- Use failing-first tests for every behavior change.

---

### Task 1: Typed benchmark registry and fixture routing

**Files:**
- Create: `backend/app/benchmarks.py`
- Modify: `backend/app/runner_support.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/services.py`
- Modify: `backend/app/runner.py`
- Test: `backend/tests/test_benchmark_registry.py`
- Test: `backend/tests/test_benchmark_pipeline.py`

**Interfaces:**
- Produces: `BenchmarkDefinition(task_id, title, fixture_root)` and `resolve_benchmark(task_id) -> BenchmarkDefinition`.
- Runner dependency consumes a catalog root, then resolves the persisted `RunRecord.task_id` before copying files.

- [ ] **Step 1: Write failing registry and routing tests**

```python
def test_registry_exposes_exactly_five_controlled_tasks():
    assert list_benchmark_ids() == ("T-01", "T-02", "T-03", "T-04", "T-05")

def test_unknown_benchmark_is_rejected(client):
    response = client.post("/api/v1/runs", json={**payload, "task_id": "T-99"})
    assert response.status_code == 422
```

- [ ] **Step 2: Run the focused tests and verify they fail because no registry/routing exists**

Run: `python -m pytest tests/test_benchmark_registry.py tests/test_benchmark_pipeline.py -q`

- [ ] **Step 3: Implement the registry, validation, and persisted task routing**

```python
@dataclass(frozen=True)
class BenchmarkDefinition:
    task_id: str
    title: str
    fixture_root: Path

def resolve_benchmark(task_id: str) -> BenchmarkDefinition:
    try:
        return BENCHMARKS[task_id]
    except KeyError as exc:
        raise ValueError("unknown benchmark task") from exc
```

- [ ] **Step 4: Run focused tests and existing T-01 pipeline tests**

Run: `python -m pytest tests/test_benchmark_registry.py tests/test_benchmark_pipeline.py -q`

- [ ] **Step 5: Commit**

```bash
git add backend/app/benchmarks.py backend/app/runner_support.py backend/app/main.py backend/app/services.py backend/app/runner.py backend/tests/test_benchmark_registry.py backend/tests/test_benchmark_pipeline.py
git commit -m "feat: route controlled benchmark catalog"
```

### Task 2: Add T-02 through T-05 controlled fixtures and repairs

**Files:**
- Create: `backend/app/fixtures/benchmark_t02/**`
- Create: `backend/app/fixtures/benchmark_t03/**`
- Create: `backend/app/fixtures/benchmark_t04/**`
- Create: `backend/app/fixtures/benchmark_t05/**`
- Modify: `backend/app/repairs.py`
- Test: `backend/tests/test_benchmark_catalog_pipeline.py`
- Test: `backend/tests/test_repairs.py`

**Interfaces:**
- Each fixture exposes `source/app.py`, `tests/test_app.py`, and `fixture.json`.
- Local repair returns valid Python preserving the fixture's public function signatures.

- [ ] **Step 1: Add parameterized failing tests for fixture completeness and five end-to-end runs**

```python
@pytest.mark.parametrize("task_id", ["T-01", "T-02", "T-03", "T-04", "T-05"])
def test_controlled_benchmark_completes_with_real_tests_and_scanners(client, task_id):
    report = run_benchmark(client, task_id)
    assert report["evaluation_kind"] == "benchmark_full"
    assert report["baseline_tests"]["status"] == "completed"
    assert report["baseline_scan_status"] == "completed"
```

- [ ] **Step 2: Run tests and verify T-02 through T-05 fail because fixtures do not exist**

Run: `python -m pytest tests/test_benchmark_catalog_pipeline.py tests/test_repairs.py -q`

- [ ] **Step 3: Add minimal vulnerable fixtures with fixed deterministic tests**

The public functions are:

```python
def read_document(root: str, requested_path: str) -> str:
    root_path = Path(root).resolve()
    candidate = (root_path / requested_path).resolve()
    if not candidate.is_relative_to(root_path):
        raise ValueError("document path escapes root")
    return candidate.read_text(encoding="utf-8")

def build_command(action: str, target: str) -> list[str]:
    commands = {"list": ["git", "status", "--short"], "show": ["git", "show", "--"]}
    if action not in commands:
        raise ValueError("unsupported action")
    return [*commands[action], target]

def get_api_token(env: Mapping[str, str]) -> str:
    token = env.get("SECUREEVAL_SAMPLE_TOKEN", "")
    if not token:
        raise ValueError("token is not configured")
    return token

def hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000).hex()

def verify_password(password: str, salt: bytes, expected: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected)
```

- [ ] **Step 4: Extend deterministic repair rules for the four known defects**

Use `Path.resolve().is_relative_to`, argv lists without `shell=True`, injected environment lookup, and `hashlib.pbkdf2_hmac` with a fixed fixture iteration count.

- [ ] **Step 5: Run the catalog and repair tests**

Run: `python -m pytest tests/test_benchmark_catalog_pipeline.py tests/test_repairs.py -q`

- [ ] **Step 6: Commit**

```bash
git add backend/app/fixtures backend/app/repairs.py backend/tests/test_benchmark_catalog_pipeline.py backend/tests/test_repairs.py
git commit -m "feat: add five controlled benchmark fixtures"
```

### Task 3: Replace demo benchmark catalog with five live tasks

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/useLiveRun.ts`
- Test: `frontend/src/benchmark-catalog.contract-test.ts`
- Modify: `frontend/scripts/verify-real-benchmark.mjs`

**Interfaces:**
- Frontend task IDs match the backend registry exactly.
- Existing `startBenchmark(taskId, categories)` remains the controller boundary.

- [ ] **Step 1: Add a failing contract test asserting the exact five live IDs and no demo-only task IDs**

```typescript
assert.deepEqual(BENCHMARK_TASKS.map(task => task.id), ['T-01', 'T-02', 'T-03', 'T-04', 'T-05'])
```

- [ ] **Step 2: Run TypeScript contract checks and verify the catalog test fails**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 3: Export the five-task catalog, update filter counts/copy, and preserve existing card layout**

- [ ] **Step 4: Extend browser verification to select a non-T-01 task and confirm its persisted real report**

- [ ] **Step 5: Run type, build, responsive, and benchmark browser checks**

Run: `pnpm exec tsc --noEmit && pnpm run verify:responsive && pnpm run verify:real-benchmark`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/useLiveRun.ts frontend/src/benchmark-catalog.contract-test.ts frontend/scripts/verify-real-benchmark.mjs
git commit -m "feat: expose five live benchmark tasks"
```

