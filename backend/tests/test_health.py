def test_health_uses_versioned_api_and_safe_shape(client) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "schema_version": "1.0",
        "status": "ok",
        "service": "secureeval-api",
    }
    assert response.headers["x-request-id"].startswith("req_")
