import hashlib
import json

from fastapi.testclient import TestClient

from app.models import RunRecord


def test_creation_persists_exact_canonical_manifest_bytes(
    client: TestClient, benchmark_run_payload: dict[str, object]
) -> None:
    payload = {
        **benchmark_run_payload,
        "scan_categories": ["secrets", "injection"],
    }
    response = client.post("/api/v1/runs", json=payload)
    assert response.status_code == 201
    run = response.json()

    with client.app.state.session_factory() as session:
        record = session.get(RunRecord, run["run_id"])
        assert record is not None
        manifest_json = record.manifest_json

    expected_hash = hashlib.sha256(manifest_json.encode("utf-8")).hexdigest()
    assert run["manifest_hash"] == f"sha256:{expected_hash}"

    manifest = json.loads(manifest_json)
    assert manifest["schema_version"] == "1.0"
    assert manifest["run_id"] == run["run_id"]
    assert manifest["created_at"] == run["created_at"]
    assert manifest["official_eligible"] is False
    assert manifest["scan_policy"]["categories"] == ["injection", "secrets"]
    assert manifest["package_locks"]["backend"]["path"] == "backend/pylock.toml"
    assert manifest["package_locks"]["backend"]["sha256"].startswith("sha256:")
    assert manifest["phase_boundaries"]["sandbox"] == {
        "image_digest": "python@sha256:31da4cb527055e4e3d7e9e006dffe9329f84ebea79eaca0a1f1c27ce61e40ca5",
        "policy_id": "sandbox-policy-v1",
    }
