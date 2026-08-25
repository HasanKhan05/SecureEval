# SecureEval backend

Phase 2 adds bounded source uploads, private 24-hour exploratory artifacts,
atomic upload-to-run provenance binding, and a digest-pinned Docker execution
foundation. Scanner, benchmark, metric, and model execution remain owned by
later phases.

The governing boundaries are defined in the repository-root
`ARCHITECTURE.md`, `API_SPEC.md`, `SECURITY_DESIGN.md`, and
`LLM_OUTPUT_CONTRACTS.md` documents.

Setup, locked installation, test, and server commands are documented in
`docs/LOCAL_DEVELOPMENT.md`. The frontend base URL is the server origin; the
typed client adds `/api/v1`. The backend restricts browser access to the
configured `SECUREEVAL_ALLOWED_ORIGINS`.

The upload endpoint accepts one UTF-8 source file or ZIP at `POST
/api/v1/uploads`. The Docker executor uses only trusted command profiles and a
pinned Linux image with no network, no mounts, a non-root user, dropped
capabilities, a read-only root, and explicit CPU/RAM/PID/time/output limits.
This remains a local-only development service: authentication is not yet in
scope, so do not expose it to an untrusted network.