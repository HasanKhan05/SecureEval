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

T-01 is the real backend-connected benchmark slice and the only workflow that runs real Pytest functional tests. Upload Code is a real exploratory local workflow: it validates Python syntax, runs Bandit and Semgrep static analysis, and evaluates repairs with the same non-executing checks. The remaining benchmark tasks and Custom Prompt Mode preserve the interactive portfolio UI with demo data. Uploaded code and uploaded tests are never executed.

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for optional LLM settings and verification commands.
