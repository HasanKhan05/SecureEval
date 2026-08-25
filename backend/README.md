# SecureEval backend

Phase 1 provides the versioned FastAPI lifecycle API, strict Pydantic request
contracts, SQLite/SQLAlchemy persistence, and Alembic migrations. Scanner,
sandbox, benchmark, metric, and model execution remain owned by later phases.

The governing boundaries are defined in the repository-root
`ARCHITECTURE.md`, `API_SPEC.md`, `SECURITY_DESIGN.md`, and
`LLM_OUTPUT_CONTRACTS.md` documents.

Setup, locked installation, test, and server commands are documented in
`docs/LOCAL_DEVELOPMENT.md`. The frontend base URL is the server origin; the
typed client adds `/api/v1`. The backend restricts browser access to the
configured `SECUREEVAL_ALLOWED_ORIGINS`.
