import json
import subprocess
import threading
import time
from pathlib import Path

import pytest

from app.sandbox.executor import DockerExecutor
from app.sandbox.policy import (
    PINNED_IMAGE,
    CommandProfile,
    SandboxPolicy,
)

pytestmark = pytest.mark.docker_live


def _source(tmp_path: Path) -> Path:
    source = tmp_path / "source"
    source.mkdir()
    (source / "source.py").write_text("value = 1\n", encoding="utf-8")
    return source


def _assert_no_container(execution_id: str) -> None:
    result = subprocess.run(
        [
            "docker",
            "ps",
            "-a",
            "--filter",
            f"label=secureeval.execution_id={execution_id}",
            "--quiet",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == ""


def test_live_policy_probe_proves_isolation_and_cleanup(tmp_path: Path) -> None:
    execution_id = "exec_" + "a" * 32
    execution_root = tmp_path / "executions"
    executor = DockerExecutor(execution_root=execution_root)

    result = executor.execute(
        _source(tmp_path), "phase2_policy_probe", execution_id=execution_id
    )

    assert result.state == "completed"
    assert result.exit_code == 0
    assert result.cleanup_state == "completed"
    assert result.image_digest == PINNED_IMAGE
    probe = json.loads(result.stdout)
    assert probe == {
        "cap_eff": "0000000000000000",
        "gid": 65532,
        "non_loopback_routes": 0,
        "root_writable": False,
        "source_writable": False,
        "uid": 65532,
        "workspace_writable": True,
    }
    assert result.policy_evidence == {
        "cap_drop": ["ALL"],
        "memory": 536870912,
        "mount_count": 0,
        "nano_cpus": 1_000_000_000,
        "network_mode": "none",
        "pids_limit": 64,
        "privileged": False,
        "readonly_rootfs": True,
        "security_opt": ["no-new-privileges:true"],
        "tmpfs": {
            "/workspace": "rw,noexec,nosuid,nodev,size=67108864,uid=65532,gid=65532,mode=0700"
        },
        "user": "65532:65532",
    }
    _assert_no_container(execution_id)
    assert list(execution_root.iterdir()) == []


def test_live_failure_timeout_and_output_are_bounded_and_cleaned(tmp_path: Path) -> None:
    profiles = {
        "fail": CommandProfile("fail", "import sys; sys.stderr.write('failed\\n'); sys.exit(7)"),
        "sleep": CommandProfile("sleep", "import time; time.sleep(5)"),
        "output": CommandProfile("output", "print('x' * 10000)"),
    }
    policy = SandboxPolicy(profiles=profiles)
    source = _source(tmp_path)

    failed_id = "exec_" + "b" * 32
    failed = DockerExecutor(tmp_path / "failed", policy=policy).execute(
        source, "fail", execution_id=failed_id
    )
    assert (failed.state, failed.exit_code, failed.stderr) == ("failed", 7, "failed\n")
    _assert_no_container(failed_id)

    timeout_id = "exec_" + "c" * 32
    timed_out = DockerExecutor(
        tmp_path / "timeout", policy=policy, timeout_seconds=0.5
    ).execute(source, "sleep", execution_id=timeout_id)
    assert timed_out.state == "timeout"
    assert timed_out.cleanup_state == "completed"
    _assert_no_container(timeout_id)

    output_id = "exec_" + "d" * 32
    output = DockerExecutor(
        tmp_path / "output", policy=policy, output_limit=1024
    ).execute(source, "output", execution_id=output_id)
    assert output.state == "completed"
    assert output.output_truncated is True
    assert len(output.stdout.encode("utf-8")) == 1024
    _assert_no_container(output_id)


def test_live_cancellation_removes_active_container(tmp_path: Path) -> None:
    execution_id = "exec_" + "e" * 32
    policy = SandboxPolicy(
        profiles={"sleep": CommandProfile("sleep", "import time; time.sleep(30)")}
    )
    executor = DockerExecutor(tmp_path / "cancel", policy=policy)
    captured = []
    thread = threading.Thread(
        target=lambda: captured.append(
            executor.execute(
                _source(tmp_path), "sleep", execution_id=execution_id
            )
        )
    )
    thread.start()
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        active = subprocess.run(
            [
                "docker",
                "ps",
                "-a",
                "--filter",
                f"label=secureeval.execution_id={execution_id}",
                "--quiet",
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if active:
            break
        time.sleep(0.05)
    assert active
    assert executor.cancel(execution_id) is True
    thread.join(timeout=10)

    assert not thread.is_alive()
    assert captured[0].state == "cancelled"
    assert captured[0].cleanup_state == "completed"
    _assert_no_container(execution_id)
