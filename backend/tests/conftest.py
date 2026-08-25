from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    return f"sqlite:///{(tmp_path / 'secureeval.db').as_posix()}"


@pytest.fixture
def client(database_url: str) -> Iterator[TestClient]:
    with TestClient(create_app(database_url=database_url)) as test_client:
        yield test_client


@pytest.fixture
def benchmark_run_payload() -> dict[str, object]:
    return {
        "mode": "benchmark",
        "task_id": "task_demo_001",
        "scan_categories": ["injection", "secrets"],
        "strategies": ["vulnerability_specific_v1"],
    }
