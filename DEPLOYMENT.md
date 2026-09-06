# SecureEval Deployment Guide

This document describes how to build, configure, and run SecureEval for deployment without requiring local development defaults.

## Architecture Overview

- **Frontend**: Static React + Vite Single Page Application (SPA).
- **Backend**: FastAPI Python application exposing REST endpoints (/api/v1/*) and health probes (/health, /api/v1/health).
- **LLM Gateway**: OmniRoute OpenAI-compatible endpoint.
- **Code Execution Sandbox**: Local Docker daemon for isolated container smoke-testing and execution.

---

## 1. Frontend Deployment

### Build Command
From `frontend/`:
```bash
npm install
npm run build
```
This compiles production assets into `frontend/dist/`, which can be served by Nginx, Caddy, Cloudflare Pages, S3, or any static web server.

### Configuration
Set before running `npm run build` (or configure in `frontend/.env`):
| Variable | Description | Example / Default |
|---|---|---|
| `VITE_SECUREEVAL_API_URL` | Base URL of the SecureEval backend | `https://api.secureeval.example.com` (default: `http://127.0.0.1:8000`) |

*Note: If frontend and backend are served behind the same reverse proxy on the same origin, `VITE_SECUREEVAL_API_URL` can be left empty.*

---

## 2. Backend Deployment

### Start Command
From `backend/`:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Or run directly using the configured host/port:
```bash
python -m app.main
```

### Required Environment Variables
Configure these in `backend/.env` or as container/server environment variables:

| Variable | Description | Production Example | Default |
|---|---|---|---|
| `SECUREEVAL_HOST` | Server bind host | `0.0.0.0` | `0.0.0.0` |
| `SECUREEVAL_PORT` | Server bind port | `8000` | `8000` |
| `SECUREEVAL_ENV` | Environment mode | `production` | `development` |
| `SECUREEVAL_DATABASE_URL` | SQLAlchemy database URL | `sqlite:///./data/secureeval_prod.db` | `sqlite:///./data/secureeval.db` |
| `SECUREEVAL_ARTIFACT_ROOT` | Path for persisted upload artifacts | `/var/data/secureeval/artifacts` | `./data/artifacts` |
| `SECUREEVAL_ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | `https://secureeval.example.com` | `http://localhost:8443,http://127.0.0.1:8443` |
| `SECUREEVAL_TOOL_TIMEOUT_SECONDS`| Scanner timeout (Bandit/Semgrep/pytest) | `60` | `60` |
| `OMNIROUTE_BASE_URL` | Base URL for OmniRoute LLM gateway | `https://omniroute.internal:20128/v1` | `http://localhost:20128/v1` |
| `OMNIROUTE_API_KEY` | Bearer token / API key for OmniRoute | `<your-secret-key>` | `""` |
| `NORMAL_ASSISTANT_MODEL` | Model for code generation and upload repairs | `auto/best-coding` | `auto/best-coding` |
| `EXPERIMENT_MODEL` | Model for benchmark evaluation | `gemini/gemini-3.1-flash-lite` | `gemini/gemini-3.1-flash-lite` |

---

## 3. Important Deployment Requirements & Limitations

1. **Docker Sandbox Execution**:
   SecureEval relies on Docker (`docker run` / Docker daemon) to execute generated code safely during **Generate & Evaluate** smoke testing. **Benchmark Mode** runs repository-controlled Pytest + Bandit/Semgrep without untrusted execution. **Analyze Code** does NOT execute uploaded code. Any host running Generate & Evaluate must have access to a functional Docker daemon and the appropriate execution images.

2. **OmniRoute Reachability**:
   In local development, `http://localhost:20128/v1` connects to a locally running OmniRoute instance. In a remote or multi-container deployment, `OMNIROUTE_BASE_URL` must point to a network-reachable URI accessible from the backend container/host.

3. **Database Persistence**:
   SQLite (`sqlite:///./data/secureeval.db`) is the default and only tested database, requiring local volume mounts for production persistence. Running multiple uvicorn workers requires setting up a managed database such as PostgreSQL; however, this requires installing the appropriate driver (e.g. `psycopg2` or `asyncpg`) which is not included out-of-the-box.

4. **Health Check Probes**:
   Both `/health` and `/api/v1/health` return HTTP 200 `{"status":"ok"}` for container orchestrators and load balancers.
