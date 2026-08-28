# Real Custom Prompt and Smoke Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Custom Prompt Mode to real schema-constrained AI generation and isolated Docker smoke execution with honest evidence and persistence.

**Architecture:** A dedicated custom runner obtains exactly one Python module from the configured OpenAI-compatible API, validates it, and reuses the static scanner/repair pipeline. A small Docker adapter supplies bounded smoke-execution evidence without ever running generated code on the host.

**Tech Stack:** Python 3.14, FastAPI, Pydantic, httpx, Docker CLI, Bandit, Semgrep, SQLite, React 19, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-custom-ai-execution-design.md`

## Global Constraints

- No generated-code fallback in Custom Prompt Mode.
- API keys remain environment-only and are never logged, persisted, or returned.
- Reject non-code, Markdown-fenced, invalid, or oversized output.
- Never execute generated code on the Windows host.
- Docker-unavailable is an honest nonfatal evidence state.
- Preserve Figma layout and exclude custom results from official aggregates.
- Use failing-first tests for every behavior change.

---

### Task 1: Strict real code-generation contract

**Files:**
- Modify: `backend/app/llm/contracts.py`
- Modify: `backend/app/llm/client.py`
- Create: `backend/app/generated_code.py`
- Test: `backend/tests/test_custom_generation.py`
- Test: `backend/tests/test_llm_client.py`

**Interfaces:**
- Produces: `GeneratedProgram(code: str)` and `validate_generated_python(code: str) -> SyntaxValidation`.
- `generate_program(prompt, client) -> LlmResult[GeneratedProgram]` never creates fallback code.

- [ ] **Step 1: Write failing tests for completed structured code, missing configuration, Markdown fences, invalid syntax, oversize output, and real usage fields**

```python
def test_generation_requires_real_configured_client():
    result = generate_program("Create a small Python utility.", unavailable_client)
    assert result.value is None
    assert result.status == "unavailable"

def test_generated_program_rejects_markdown():
    with pytest.raises(ValueError):
        validate_generated_python("```python\nprint('x')\n```")
```

- [ ] **Step 2: Run focused tests and verify failure because generation contracts do not exist**

Run: `python -m pytest tests/test_custom_generation.py tests/test_llm_client.py -q`

- [ ] **Step 3: Implement strict schema generation and validation**

```python
class GeneratedProgram(StrictModel):
    code: str = Field(min_length=1, max_length=100_000)

def generate_program(prompt: str, client: LlmClient) -> LlmResult[GeneratedProgram]:
    return client.complete(GeneratedProgram, [system_message, {"role": "user", "content": prompt}])
```

- [ ] **Step 4: Run focused tests**

Run: `python -m pytest tests/test_custom_generation.py tests/test_llm_client.py -q`

- [ ] **Step 5: Commit**

```bash
git add backend/app/llm backend/app/generated_code.py backend/tests/test_custom_generation.py backend/tests/test_llm_client.py
git commit -m "feat: add strict real custom code generation"
```

### Task 2: Isolated Docker smoke execution adapter

**Files:**
- Create: `backend/app/tools/docker_smoke.py`
- Test: `backend/tests/test_docker_smoke.py`
- Test: `backend/tests/test_docker_smoke_live.py`

**Interfaces:**
- Produces: `run_docker_smoke(source_file: Path, timeout_seconds: float) -> TestExecution`.
- The adapter accepts only an absolute `.py` file beneath the trusted run root supplied by the caller.

- [ ] **Step 1: Write failing command-boundary tests for all isolation flags, absolute mount, unavailable engine, timeout, bounded output, and process-tree termination**

```python
def test_smoke_command_disables_network_and_drops_privileges(tmp_path):
    execution = capture_smoke_command(tmp_path / "program.py")
    assert "--network" in execution.argv and "none" in execution.argv
    assert "--cap-drop" in execution.argv and "ALL" in execution.argv
    assert "--read-only" in execution.argv
```

- [ ] **Step 2: Run adapter tests and verify failure because the adapter is missing**

Run: `python -m pytest tests/test_docker_smoke.py -q`

- [ ] **Step 3: Implement the fixed Docker command and map outcomes to `TestExecution`**

Use image `python:3.14-alpine`, `--network none`, `--read-only`, `--memory 128m`, `--cpus 0.5`, `--pids-limit 64`, `--cap-drop ALL`, `--security-opt no-new-privileges`, a read-only `/workspace/program.py` mount, and `--tmpfs /tmp:rw,noexec,nosuid,size=16m`.

- [ ] **Step 4: Run unit tests and the live test only when Docker is available**

Run: `python -m pytest tests/test_docker_smoke.py -q`

- [ ] **Step 5: Commit**

```bash
git add backend/app/tools/docker_smoke.py backend/tests/test_docker_smoke.py backend/tests/test_docker_smoke_live.py
git commit -m "feat: add isolated custom smoke execution"
```

### Task 3: Custom Prompt backend lifecycle, repairs, and reports

**Files:**
- Create: `backend/app/custom_runner.py`
- Modify: `backend/app/runner.py`
- Modify: `backend/app/runner_support.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/reports.py`
- Modify: `backend/app/scoring.py`
- Test: `backend/tests/test_custom_pipeline.py`
- Test: `backend/tests/test_reports.py`

**Interfaces:**
- Dispatches `Mode.CUSTOM_PROMPT` to `execute_custom_baseline` and `execute_custom_repairs`.
- Reports use `evaluation_kind="custom_prompt_smoke"` and `score_basis="static_smoke"`.

- [ ] **Step 1: Replace the unsupported-mode test with failing lifecycle tests for success, missing API, invalid response, Docker unavailable, cancellation, repair failure isolation, and refresh persistence**

```python
def test_custom_prompt_completes_with_real_generated_evidence(client, configured_llm_transport):
    report = run_custom_prompt(client)
    assert report["mode"] == "custom_prompt"
    assert report["evaluation_kind"] == "custom_prompt_smoke"
    assert report["strategy_results"][0]["llm_usage"]["source"] == "llm"
```

- [ ] **Step 2: Run focused pipeline tests and verify they fail at unsupported mode**

Run: `python -m pytest tests/test_custom_pipeline.py tests/test_reports.py -q`

- [ ] **Step 3: Implement the custom baseline and repair lifecycle by reusing syntax/scanner helpers and the Docker adapter**

- [ ] **Step 4: Add deterministic static/smoke scoring that never labels smoke execution as trusted functionality**

- [ ] **Step 5: Run focused and persistence tests**

Run: `python -m pytest tests/test_custom_pipeline.py tests/test_reports.py tests/test_result_persistence.py -q`

- [ ] **Step 6: Commit**

```bash
git add backend/app/custom_runner.py backend/app/runner.py backend/app/runner_support.py backend/app/schemas.py backend/app/reports.py backend/app/scoring.py backend/tests/test_custom_pipeline.py backend/tests/test_reports.py
git commit -m "feat: run real custom prompt evaluations"
```

### Task 4: Live Custom Prompt frontend and verification

**Files:**
- Modify: `frontend/src/useLiveRun.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/LiveScreens.tsx`
- Modify: `frontend/src/contracts/api-v1.ts`
- Create: `frontend/src/custom-prompt.contract-test.ts`
- Create: `frontend/scripts/verify-real-custom-prompt.mjs`
- Modify: `frontend/package.json`
- Modify: `README.md`
- Modify: `docs/LOCAL_DEVELOPMENT.md`

**Interfaces:**
- Produces `startCustomPrompt(prompt, categories)` in `useLiveRun`.
- Consumes `custom_prompt_smoke` reports and renders smoke status separately from functional tests.

- [ ] **Step 1: Add failing compile contracts for custom payload, report kind, and smoke-specific evidence copy**

```typescript
assert.deepEqual(customPayload.mode, 'custom_prompt')
assert.equal(customReport.evaluation_kind, 'custom_prompt_smoke')
assert.match(CUSTOM_EVIDENCE_COPY.smoke, /smoke execution/i)
```

- [ ] **Step 2: Run TypeScript and verify failure because the controller/contracts are missing**

Run: `pnpm exec tsc --noEmit`

- [ ] **Step 3: Connect the existing Figma form to the live controller and add honest API/Docker/error copy**

- [ ] **Step 4: Add browser verification using a controlled local fake provider transport at the backend boundary; assert the UI displays provider-returned code/usage and never demo values**

- [ ] **Step 5: Run frontend and browser checks**

Run: `pnpm exec tsc --noEmit && pnpm run verify:responsive && pnpm run verify:real-custom-prompt && pnpm run verify:real-benchmark && pnpm run verify:real-upload`

- [ ] **Step 6: Run the full backend suite excluding opt-in Docker-live tests**

Run: `python -m pytest -m "not docker_live"`

- [ ] **Step 7: Commit**

```bash
git add frontend README.md docs/LOCAL_DEVELOPMENT.md
git commit -m "feat: connect live custom prompt experience"
```

