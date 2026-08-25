from dataclasses import dataclass
from collections.abc import Mapping

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


@dataclass(slots=True)
class APIError(Exception):
    status_code: int
    code: str
    message: str


def error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        headers=headers,
        content={
            "error": {
                "code": code,
                "message": message,
                "request_id": request.state.request_id,
            }
        },
    )


async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return error_response(request, exc.status_code, exc.code, exc.message)

async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    if exc.status_code == 404:
        return error_response(
            request,
            404,
            "not_found",
            "Resource not found.",
            headers=exc.headers,
        )
    if exc.status_code == 405:
        return error_response(
            request,
            405,
            "method_not_allowed",
            "Method not allowed.",
            headers=exc.headers,
        )
    return error_response(
        request, exc.status_code, "http_error", "Request failed.", headers=exc.headers
    )


async def validation_error_handler(
    request: Request, _exc: RequestValidationError
) -> JSONResponse:
    return error_response(request, 422, "validation_error", "Request validation failed.")


async def unexpected_error_handler(request: Request, _exc: Exception) -> JSONResponse:
    return error_response(request, 500, "internal_error", "An internal error occurred.")
