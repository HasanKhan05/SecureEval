# SecureEval

SecureEval is a functional local AI/cybersecurity portfolio project for comparing code-repair strategies. It preserves the supplied Figma interface and connects the **T-01 User Login Service** benchmark to a real local evaluation pipeline:

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

Open `http://localhost:8443`, choose **Benchmark Mode**, select **User Login Service (T-01)**, and continue through scanning, repair selection, comparison, and persisted results.

No API key is required. Without one, repaired results are explicitly labeled `local_fallback`.

## Current scope

T-01 is the real backend-connected benchmark slice. The remaining benchmark tasks, Custom Prompt Mode, and Upload Code Mode preserve the interactive portfolio UI but currently use demo data. Uploaded code in those demo flows is not executed.

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for optional LLM settings and verification commands.
