import os
from collections.abc import Iterator
from typing import Annotated
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Path as ApiPath, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.database import create_database, upgrade_database
from app.llm.client import LlmClient
from app.reports import load_report
from app.runner import execute_run_baseline, execute_run_repairs
from app.runner_support import RunnerDependencies, cleanup_run
from app.errors import (
    APIError,
    api_error_handler,
    http_exception_handler,
    unexpected_error_handler,
    error_response,
    validation_error_handler,
)
from app.schemas import (
    HealthResponse,
    RunCreate,
    RunProgress,
    RunReport,
    RunResponse,
    StrategySelection,
    UploadReceipt,
)
from app.uploads.policy import UploadPolicy, UploadPurpose
from app.uploads.service import (
    accept_upload,
    cleanup_expired_uploads,
    read_bounded_upload,
    reject_upload,
)
from app.uploads.store import ArtifactStore
from app.uploads.validation import UploadRejected
from app.services import (
    cancel_run,
    configure_strategies,
    create_run,
    get_progress,
    get_run,
    start_run,
)

DEFAULT_DATABASE_URL = "sqlite:///./data/secureeval.db"
DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:8443",
    "http://127.0.0.1:8443",
)
RunId = Annotated[
    str, ApiPath(min_length=36, max_length=36, pattern=r"^run_[0-9a-f]{32}$")
]


def load_backend_env() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    backend_env = backend_dir / ".env"
    root_env = backend_dir.parent / ".env"
    if backend_env.is_file():
        load_dotenv(dotenv_path=backend_env, override=False)
    if root_env.is_file():
        load_dotenv(dotenv_path=root_env, override=False)


load_backend_env()


def _session_dependency(request: Request) -> Iterator[Session]:
    factory: sessionmaker[Session] = request.app.state.session_factory
    with factory() as session:
        yield session


def create_app(
    database_url: str | None = None,
    allowed_origins: list[str] | tuple[str, ...] | None = None,
    artifact_root: Path | None = None,
    llm_client: LlmClient | None = None,
) -> FastAPI:
    load_backend_env()
    resolved_url = database_url or os.getenv("SECUREEVAL_DATABASE_URL", DEFAULT_DATABASE_URL)
    if allowed_origins is None:
        configured_origins = os.getenv("SECUREEVAL_ALLOWED_ORIGINS")
        allowed_origins = (
            tuple(item.strip() for item in configured_origins.split(",") if item.strip())
            if configured_origins else DEFAULT_ALLOWED_ORIGINS
        )
    if resolved_url.startswith("sqlite:///"):
        database_path = resolved_url.removeprefix("sqlite:///")
        if database_path != ":memory:":
            Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    upgrade_database(resolved_url)
    engine, session_factory = create_database(resolved_url)
    resolved_artifact_root = artifact_root or Path(
        os.getenv("SECUREEVAL_ARTIFACT_ROOT", "./data/artifacts")
    )
    artifact_store = ArtifactStore(resolved_artifact_root)
    upload_policy = UploadPolicy()

    base_url = os.getenv("OMNIROUTE_BASE_URL", "http://localhost:20128/v1")
    api_key = os.getenv("OMNIROUTE_API_KEY", "")
    experiment_model = os.getenv("EXPERIMENT_MODEL", "gemini/gemini-3.1-flash-lite")
    assistant_model = os.getenv("NORMAL_ASSISTANT_MODEL", "auto/best-coding")
    input_price = float(os.getenv("OMNIROUTE_INPUT_PRICE_PER_MILLION", "0"))
    output_price = float(os.getenv("OMNIROUTE_OUTPUT_PRICE_PER_MILLION", "0"))

    experiment_client = llm_client or LlmClient(
        base_url=base_url,
        api_key=api_key,
        model=experiment_model,
        input_price_per_million=input_price,
        output_price_per_million=output_price,
    )
    assistant_client = llm_client or LlmClient(
        base_url=base_url,
        api_key=api_key,
        model=assistant_model,
        input_price_per_million=input_price,
        output_price_per_million=output_price,
    )

    runner_dependencies = RunnerDependencies(
        fixtures_root=Path(__file__).parent / "fixtures",
        work_root=Path(
            os.getenv(
                "SECUREEVAL_WORK_ROOT",
                str(resolved_artifact_root.parent / "runs"),
            )
        ),
        tool_timeout_seconds=float(
            os.getenv("SECUREEVAL_TOOL_TIMEOUT_SECONDS", "30")
        ),
        llm_client=experiment_client,
        experiment_llm_client=experiment_client,
        assistant_llm_client=assistant_client,
        artifact_store=artifact_store,
    )
    runner_dependencies.work_root.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(_application: FastAPI):
        with session_factory() as session:
            cleanup_expired_uploads(session, artifact_store)
        yield
        engine.dispose()

    application = FastAPI(title="SecureEval API", version="1.0.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed_origins),
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.state.engine = engine
    application.state.session_factory = session_factory
    application.state.artifact_store = artifact_store
    application.state.upload_policy = upload_policy
    application.state.runner_dependencies = runner_dependencies

    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = f"req_{uuid4().hex}"
        origin = request.headers.get("origin")
        is_preflight = (
            request.method == "OPTIONS"
            and origin is not None
            and "access-control-request-method" in request.headers
        )
        if is_preflight and origin not in allowed_origins:
            response = error_response(
                request, 400, "cors_origin_denied", "CORS origin denied."
            )
        else:
            response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    application.add_exception_handler(APIError, api_error_handler)
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.add_exception_handler(Exception, unexpected_error_handler)

    @application.get("/health", response_model=HealthResponse)
    @application.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    @application.post("/api/v1/runs", response_model=RunResponse, status_code=status.HTTP_201_CREATED)
    def create(payload: RunCreate, session: Session = Depends(_session_dependency)) -> RunResponse:
        return create_run(session, payload)

    @application.post(
        "/api/v1/uploads",
        response_model=UploadReceipt,
        status_code=status.HTTP_201_CREATED,
    )
    async def upload(
        purpose: Annotated[UploadPurpose, Form()],
        source: Annotated[UploadFile, File()],
        session: Session = Depends(_session_dependency),
    ) -> UploadReceipt:
        try:
            payload = await read_bounded_upload(source, upload_policy)
            cleanup_expired_uploads(session, artifact_store)
            return accept_upload(
                session,
                artifact_store,
                purpose,
                source.filename or "",
                payload,
                upload_policy,
            )
        except UploadRejected as exc:
            reject_upload(session, exc.reason)
            raise APIError(
                400, "upload_rejected", "Source upload was rejected."
            ) from exc

    @application.get("/api/v1/runs/{run_id}", response_model=RunResponse)
    def read(run_id: RunId, session: Session = Depends(_session_dependency)) -> RunResponse:
        return get_run(session, run_id)


    @application.post("/api/v1/runs/{run_id}/start", response_model=RunResponse)
    def start(
        run_id: RunId,
        background_tasks: BackgroundTasks,
        session: Session = Depends(_session_dependency),
    ) -> RunResponse:
        response = start_run(session, run_id)
        background_tasks.add_task(
            execute_run_baseline,
            run_id,
            session_factory,
            runner_dependencies,
        )
        return response

    @application.get("/api/v1/runs/{run_id}/progress", response_model=RunProgress)
    def progress(
        run_id: RunId,
        session: Session = Depends(_session_dependency),
    ) -> RunProgress:
        return get_progress(session, run_id)

    @application.post("/api/v1/runs/{run_id}/strategies", response_model=RunResponse)
    def strategies(
        run_id: RunId,
        payload: StrategySelection,
        background_tasks: BackgroundTasks,
        session: Session = Depends(_session_dependency),
    ) -> RunResponse:
        response = configure_strategies(session, run_id, payload)
        background_tasks.add_task(
            execute_run_repairs,
            run_id,
            session_factory,
            runner_dependencies,
        )
        return response

    @application.get("/api/v1/runs/{run_id}/report", response_model=RunReport)
    def report(
        run_id: RunId,
        session: Session = Depends(_session_dependency),
    ) -> RunReport:
        return load_report(session, run_id)

    @application.post("/api/v1/runs/{run_id}/cancel", response_model=RunResponse)
    def cancel(run_id: RunId, session: Session = Depends(_session_dependency)) -> RunResponse:
        response = cancel_run(session, run_id)
        cleanup_run(runner_dependencies, run_id)
        return response

    return application


app = create_app()


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("SECUREEVAL_HOST", os.getenv("HOST", "0.0.0.0"))
    port = int(os.getenv("SECUREEVAL_PORT", os.getenv("PORT", "8000")))
    uvicorn.run("app.main:app", host=host, port=port)
