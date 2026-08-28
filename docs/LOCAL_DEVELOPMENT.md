# Local development

SecureEval has a React/Vite frontend and a localhost FastAPI backend. The supplied Figma UI remains the visual baseline.

## Supported workflow

The real backend-connected workflows are:

1. Benchmark Mode
2. Any controlled task from T-01 through T-05
3. Scan-category selection
4. Pytest, Bandit, and Semgrep baseline analysis
5. One or more repair strategies, including Run All
6. Repair execution, retesting, rescanning, and deterministic scoring
7. Persisted comparison and result explanation

Upload Code is a real exploratory static-analysis workflow. It validates uploaded Python syntax, runs Bandit and Semgrep, applies selected repairs, and rescans repaired candidates. It never executes uploaded source or uploaded tests.

Custom Prompt uses a configured OpenAI-compatible API for real code generation and repairs. Generated Python is syntax-checked, scanned, and smoke-run only in restricted Docker. If Docker is stopped, smoke evidence is explicitly unavailable while scanning continues. No fake generation fallback is used.

## Prerequisites

- Node.js 22 and Corepack
- Python 3.14
- Microsoft Edge only when running the included browser verification scripts
- Docker Desktop with the Linux engine for Custom Prompt smoke execution and optional `docker_live` tests

## Backend setup

From the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r pylock.toml
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The default configuration needs no secrets and stores local data under `backend/data/`.

For real Custom Prompt generation (and optional model repairs in other modes), set values before starting Uvicorn:

```powershell
$env:SECUREEVAL_LLM_BASE_URL = "https://api.openai.com/v1"
$env:SECUREEVAL_LLM_API_KEY = "your-local-key"
$env:SECUREEVAL_LLM_MODEL = "your-structured-output-model"
```

Do not commit populated environment files or credentials. With no key/model, controlled benchmarks and Upload Code may use labeled deterministic repairs; Custom Prompt fails honestly with no generated-code fallback.

## Frontend setup

In a second terminal from the repository root:

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open `http://localhost:8443`. The frontend defaults to `http://127.0.0.1:8000` for the API. Override it only when needed:

```powershell
$env:VITE_SECUREEVAL_API_URL = "http://127.0.0.1:8000"
corepack pnpm dev
```

The selected navigation inputs and run ID are stored in browser local storage. Reports are reloaded from backend persistence after refresh.

## Verification

Backend, excluding the optional live-Docker checks:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -m "not docker_live"
```

Frontend type/build and responsive checks:

```powershell
cd frontend
corepack pnpm exec tsc --noEmit
corepack pnpm verify:responsive
```

Full real T-01 browser workflow, persistence, and API failure states:

```powershell
cd frontend
corepack pnpm verify:real-benchmark
```

Real Upload Code browser workflow, syntax/static evidence, persistence, and explicit failure states:

```powershell
cd frontend
corepack pnpm verify:real-upload
```

Real Custom Prompt provider boundary, repairs, evidence, and persistence:

```powershell
cd frontend
corepack pnpm verify:real-custom
```

The browser workflows start temporary backend and preview servers themselves. Ports 8000 and 8443 must be available.

## Local-data and safety notes

- T-01 through T-05 use controlled repository fixtures and real Pytest functional tests.
- Upload Code performs real local syntax/static analysis and repair, but never executes uploaded source or uploaded tests.
- Custom Prompt executes generated code only in restricted Docker as a smoke check, never as a trusted test suite.
- Static analysis and sample functional tests cannot prove that code is secure.
- SQLite data, artifacts, and temporary run workspaces stay local and are ignored by Git.
- Keep the API bound to localhost.
