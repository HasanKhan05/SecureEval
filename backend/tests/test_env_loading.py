import os
from pathlib import Path

from app.main import create_app, load_backend_env


def test_backend_env_loads_and_os_takes_precedence(tmp_path: Path, monkeypatch) -> None:
    test_env = tmp_path / ".env"
    test_env.write_text(
        "OMNIROUTE_BASE_URL=https://from-env-file.example/v1\n"
        "OMNIROUTE_API_KEY=key-from-env-file\n"
        "NORMAL_ASSISTANT_MODEL=model-from-env-file\n",
        encoding="utf-8",
    )

    # Set one variable in OS environment to test precedence
    monkeypatch.setenv("OMNIROUTE_API_KEY", "os-override-key")
    monkeypatch.delenv("OMNIROUTE_BASE_URL", raising=False)
    monkeypatch.delenv("NORMAL_ASSISTANT_MODEL", raising=False)

    from dotenv import load_dotenv

    load_dotenv(dotenv_path=test_env, override=False)

    assert os.getenv("OMNIROUTE_API_KEY") == "os-override-key"
    assert os.getenv("OMNIROUTE_BASE_URL") == "https://from-env-file.example/v1"
    assert os.getenv("NORMAL_ASSISTANT_MODEL") == "model-from-env-file"


def test_custom_runner_reports_clear_error_when_unconfigured(client) -> None:
    response = client.post(
        "/api/v1/runs",
        json={
            "mode": "custom_prompt",
            "custom_prompt": "Create a Python utility function to parse JSON.",
            "scan_categories": ["injection"],
            "strategies": ["vulnerability_specific_v1"],
        },
    )
    assert response.status_code == 201
    run_id = response.json()["run_id"]

    start_response = client.post(f"/api/v1/runs/{run_id}/start")
    assert start_response.status_code == 200

    run = client.get(f"/api/v1/runs/{run_id}").json()
    assert run["status"] == "failed"
    assert run["failure_code"] == "generation_unavailable"
    assert "LLM client is not configured" in run["failure_message"]
    assert "OMNIROUTE_API_KEY" in run["failure_message"]
