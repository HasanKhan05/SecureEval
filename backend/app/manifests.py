import hashlib
import json
import os
import platform
from pathlib import Path

from app.enums import StrategyId
from app.schemas import RunCreate

CONFIGURATION_ID = "phase-1-foundation-v1"
BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_ROOT.parent


def _sha256_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def canonical_manifest(
    payload: RunCreate,
    strategies: list[StrategyId],
    *,
    run_id: str,
    created_at: str,
) -> str:
    manifest = {
        "schema_version": "1.0",
        "configuration_id": CONFIGURATION_ID,
        "run_id": run_id,
        "created_at": created_at,
        "mode": payload.mode.value,
        "task_id": payload.task_id,
        "upload_id": payload.upload_id,
        "custom_prompt": payload.custom_prompt,
        "official_eligible": False,
        "source_revision": os.getenv(
            "SECUREEVAL_SOURCE_REVISION", "unavailable_local_checkout"
        ),
        "scan_policy": {
            "categories": sorted(item.value for item in payload.scan_categories),
            "rule_bundle_version": "unavailable_until_phase_3",
        },
        "strategy_ids": [item.value for item in strategies],
        "package_locks": {
            "backend": {
                "path": "backend/pylock.toml",
                "sha256": _sha256_file(BACKEND_ROOT / "pylock.toml"),
            },
            "frontend": {
                "path": "frontend/pnpm-lock.yaml",
                "sha256": _sha256_file(REPOSITORY_ROOT / "frontend" / "pnpm-lock.yaml"),
            },
        },
        "corpus": {
            "version": "unavailable_until_phase_4",
            "public_hash": None,
            "protected_evaluator_hash": None,
        },
        "commands": {
            "test": "unavailable_until_phase_4",
            "scanner": "unavailable_until_phase_3",
        },
        "model_configuration": "unavailable_until_phase_6",
        "metric_policy_version": "unavailable_until_phase_5",
        "platform": {
            "python": platform.python_version(),
            "system": platform.system(),
        },
        "phase_boundaries": {
            "sandbox": "unavailable_until_phase_2",
            "scanner": "unavailable_until_phase_3",
            "benchmark": "unavailable_until_phase_4",
            "metrics": "unavailable_until_phase_5",
            "llm": "unavailable_until_phase_6",
        },
    }
    return json.dumps(
        manifest,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def manifest_hash(manifest_json: str) -> str:
    digest = hashlib.sha256(manifest_json.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"
