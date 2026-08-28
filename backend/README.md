# SecureEval local backend

The FastAPI service powers five controlled benchmark workflows, exploratory Upload Code static analysis, and real-provider Custom Prompt generation. It runs scanners, repairs, deterministic scoring, and SQLite report persistence; controlled fixtures also run Pytest.

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

Model credentials are optional for controlled benchmarks and Upload Code, which can use labeled deterministic repairs. Custom Prompt requires both `SECUREEVAL_LLM_API_KEY` and `SECUREEVAL_LLM_MODEL` and never substitutes generated or repaired code locally.

An optional OpenAI-compatible endpoint can be configured with:

- `SECUREEVAL_LLM_BASE_URL`
- `SECUREEVAL_LLM_API_KEY`
- `SECUREEVAL_LLM_MODEL`
- `SECUREEVAL_LLM_INPUT_PRICE_PER_MILLION`
- `SECUREEVAL_LLM_OUTPUT_PRICE_PER_MILLION`

The backend validates strict structured model output. In Custom Prompt, failed, timed-out, unavailable, or invalid output is reported honestly with no fallback. Generated code is never run on the host.

## Tests

```powershell
python -m pytest -m "not docker_live"
```

The three `docker_live` tests cover the older isolated Docker executor and require Docker Desktop with the Linux engine:

```powershell
python -m pytest -m docker_live
```

Docker is not required for controlled benchmarks or Upload Code. Custom Prompt uses the Linux engine for a network-disabled, read-only, resource-limited smoke check; when Docker is unavailable, the report says so and static scanning continues.
