# SecureEval local backend

The FastAPI service powers the real T-01 portfolio workflow. It runs the controlled benchmark fixture through Pytest, Bandit, and Semgrep; applies selected repairs; rescans and retests each candidate; calculates deterministic scores; and persists the report in local SQLite storage.

It is a localhost-only portfolio service. Do not expose it to an untrusted network or treat its output as a security guarantee.

## Start

Requires Python 3.14.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r pylock.toml
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The service applies database migrations at startup. Defaults:

- API: `http://127.0.0.1:8000`
- SQLite: `backend/data/secureeval.db`
- Stored artifacts: `backend/data/artifacts`
- Temporary run workspaces: `backend/data/runs`

These generated paths are ignored by Git.

## Repair behavior

No model credentials are required. When `SECUREEVAL_LLM_API_KEY` or `SECUREEVAL_LLM_MODEL` is empty, SecureEval uses its deterministic T-01 repair and records `local_fallback` in the report.

An optional OpenAI-compatible endpoint can be configured with:

- `SECUREEVAL_LLM_BASE_URL`
- `SECUREEVAL_LLM_API_KEY`
- `SECUREEVAL_LLM_MODEL`
- `SECUREEVAL_LLM_INPUT_PRICE_PER_MILLION`
- `SECUREEVAL_LLM_OUTPUT_PRICE_PER_MILLION`

The backend validates structured model output. Failed, timed-out, or invalid model output falls back locally rather than being treated as valid evidence.

## Tests

```powershell
python -m pytest -m "not docker_live"
```

The three `docker_live` tests cover the older isolated Docker executor and require Docker Desktop with the Linux engine:

```powershell
python -m pytest -m docker_live
```

Docker is not required for the current real T-01 frontend workflow.
