# Local development baseline

Phase 0 establishes the repository layout and verifies the supplied frontend.
The backend is documentation-only until Phase 1.

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
- Python and Docker are not used by Phase 0; Phase 1 will pin and document the
  backend runtime before backend code is introduced

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

Copy `frontend/.env.example` to a local `.env` only when API integration begins.
Only browser-safe values may use the `VITE_` prefix.

## Backend placeholder

`backend/.env.example` contains names and non-secret development defaults only.
Do not commit a populated `.env`, provider credential, upload, SQLite database,
artifact, hidden benchmark asset, or raw model response.

Phase 1 owns the backend package definition, dependency lock, FastAPI start
command, Pydantic contracts, and test command. Phase 0 does not pre-empt those
implementation choices.
