# Local development

Phase 0 preserved the supplied frontend. Phase 1 adds the versioned FastAPI
boundary while leaving the Figma runtime UI source unchanged.

## Layout

- `frontend/` — complete Figma Make React/Vite export; visual source of truth.
- `backend/` — reserved FastAPI boundary for Phase 1.
- `frontend/src/contracts/api-v1.ts` — non-runtime TypeScript contract draft.
- `docs/phase-0/` — baseline inventory and Phase 0 evidence.
- repository-root Markdown files — governing product, architecture, security,
  testing, reproducibility, risk, and phase-control documentation.

The Figma export's own `frontend/AGENTS.md` and `frontend/CLAUDE.md` are retained
as source metadata. The repository-root `AGENTS.md` and the user's instructions
govern SecureEval work.

## Prerequisites

- Node.js 22 (the Figma export's `.mise.toml` pin)
- pnpm 10.34.3 for the supplied lockfile, or Corepack-compatible pnpm
- Python 3.14 for the committed platform-specific `backend/pylock.toml`
- Docker is introduced in Phase 2, not required for the Phase 1 lifecycle API

## Frontend

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm dev
```

The development server defaults to `http://localhost:8443` in the Figma
configuration. The production build is emitted to `frontend/dist/` and is
ignored by Git.

Copy `frontend/.env.example` to `frontend/.env` for local API use. The base
URL is the server origin; the typed client appends `/api/v1`.

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r pylock.toml
.\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e .
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

The PEP 751 lock contains hashes for the full Python 3.14/Windows dependency
graph. The application applies Alembic migrations at startup and stores local
SQLite data under `backend/data/`, which is ignored.

`backend/.env.example` contains non-secret defaults. Its CORS allowlist is
limited to the actual Figma development origins on port 8443. Do not commit a
populated `.env`, credential, upload, SQLite database, artifact, hidden
benchmark asset, or raw model response.
