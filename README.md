# SecureEval

SecureEval is a functional local AI/cybersecurity portfolio project for comparing code-repair strategies. It preserves the supplied Figma interface and connects five controlled benchmarks, Custom Prompt, and Upload Code to real local workflows:

- Pytest functional tests
- Bandit and Semgrep static analysis
- Optional OpenAI-compatible structured repair calls
- Deterministic local repair fallback when no API key is configured
- Deterministic scoring, strategy comparison, and SQLite result persistence

The displayed evidence describes one controlled sample run. It is not a security certification or guarantee.

## Quick start

Requirements: Node.js 22 with Corepack and Python 3.14.

Terminal 1:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r pylock.toml
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Terminal 2:

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open `http://localhost:8443`, choose a mode, and continue through scanning, repair selection, comparison, and persisted results.

No API key is required for the five controlled benchmarks or Upload Code. Custom Prompt requires `SECUREEVAL_LLM_API_KEY` and `SECUREEVAL_LLM_MODEL`; it never substitutes fake generated code.

## Current scope

T-01 through T-05 are controlled repository fixtures that run real Pytest, Bandit, Semgrep, repair, scoring, and persistence. Upload Code performs non-executing syntax/static analysis. Custom Prompt makes real schema-constrained AI calls, scans the generated Python, and optionally smoke-runs it only inside restricted Docker. Smoke execution is not a trusted functional test suite or a security guarantee.

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for optional LLM settings and verification commands.
