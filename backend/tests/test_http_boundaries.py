from fastapi.testclient import TestClient


def assert_error_envelope(response, *, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    assert response.json()["error"]["code"] == code
    assert response.json()["error"]["message"] == message
    assert response.json()["error"]["request_id"].startswith("req_")
    assert response.headers["x-request-id"] == response.json()["error"]["request_id"]


def test_framework_404_and_405_use_safe_error_envelopes(client: TestClient) -> None:
    missing = client.get("/api/v1/not-a-route")
    wrong_method = client.put("/api/v1/health")

    assert_error_envelope(
        missing, status=404, code="not_found", message="Resource not found."
    )
    assert_error_envelope(
        wrong_method,
        status=405,
        code="method_not_allowed",
        message="Method not allowed.",
    )
    assert "GET" in wrong_method.headers["allow"]


def test_cors_allows_only_configured_development_origin(client: TestClient) -> None:
    allowed = client.options(
        "/api/v1/runs",
        headers={
            "Origin": "http://localhost:8443",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    denied = client.options(
        "/api/v1/runs",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:8443"
    assert "POST" in allowed.headers["access-control-allow-methods"]
    assert "access-control-allow-origin" not in denied.headers
    assert_error_envelope(
        denied,
        status=400,
        code="cors_origin_denied",
        message="CORS origin denied.",
    )


def test_malformed_run_identifier_is_rejected_before_storage_query(client: TestClient) -> None:
    response = client.get("/api/v1/runs/not-valid")

    assert_error_envelope(
        response,
        status=422,
        code="validation_error",
        message="Request validation failed.",
    )
