from __future__ import annotations

import io
import json
import os
import shutil
import stat
import subprocess
import tarfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.sandbox.policy import PINNED_IMAGE, POLICY_ID, SandboxPolicy


@dataclass(frozen=True)
class ExecutionResult:
    execution_id: str
    state: str
    exit_code: int | None
    stdout: str
    stderr: str
    output_truncated: bool
    cleanup_state: str
    policy_id: str
    image_digest: str
    policy_evidence: dict[str, object]


class _BoundedOutput:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.stdout = bytearray()
        self.stderr = bytearray()
        self.total_seen = 0
        self.lock = threading.Lock()

    def add(self, stream: str, data: bytes) -> None:
        with self.lock:
            remaining = max(self.limit - len(self.stdout) - len(self.stderr), 0)
            target = self.stdout if stream == "stdout" else self.stderr
            target.extend(data[:remaining])
            self.total_seen += len(data)

    @property
    def truncated(self) -> bool:
        return self.total_seen > self.limit


def _remove_readonly(function, path: str, _excinfo) -> None:
    os.chmod(path, stat.S_IWRITE)
    function(path)


class DockerExecutor:
    def __init__(
        self,
        execution_root: Path,
        *,
        policy: SandboxPolicy | None = None,
        timeout_seconds: float = 60,
        output_limit: int = 64 * 1024,
    ) -> None:
        self.execution_root = execution_root.resolve()
        self.execution_root.mkdir(parents=True, exist_ok=True)
        self.policy = policy or SandboxPolicy()
        self.timeout_seconds = timeout_seconds
        self.output_limit = output_limit
        self._active: dict[str, threading.Event] = {}
        self._lock = threading.Lock()

    def cancel(self, execution_id: str) -> bool:
        with self._lock:
            event = self._active.get(execution_id)
        if event is None:
            return False
        event.set()
        return True

    @staticmethod
    def _simple(arguments: list[str]) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(arguments, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("Docker operation failed.")
        return result

    @staticmethod
    def _source_archive(source_path: Path) -> bytes:
        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w") as archive:
            for path in sorted(source_path.rglob("*")):
                relative = path.relative_to(source_path).as_posix()
                info = tarfile.TarInfo(relative)
                info.mtime = 0
                if path.is_dir():
                    info.type = tarfile.DIRTYPE
                    info.mode = 0o555
                    archive.addfile(info)
                elif path.is_file():
                    content = path.read_bytes()
                    info.size = len(content)
                    info.mode = 0o444
                    archive.addfile(info, io.BytesIO(content))
                else:
                    raise ValueError("unsupported staged source type")
        return buffer.getvalue()

    def _attached(
        self,
        container_name: str,
        cancelled: threading.Event,
        source_path: Path,
    ) -> tuple[str, int | None, _BoundedOutput]:
        process = subprocess.Popen(
            ["docker", "start", "--attach", "--interactive", container_name],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        output = _BoundedOutput(self.output_limit)

        def drain(stream_name: str, pipe) -> None:
            while chunk := pipe.read(8192):
                output.add(stream_name, chunk)

        threads = [
            threading.Thread(target=drain, args=("stdout", process.stdout)),
            threading.Thread(target=drain, args=("stderr", process.stderr)),
        ]
        for thread in threads:
            thread.start()
        try:
            process.stdin.write(self._source_archive(source_path))
            process.stdin.close()
        except BrokenPipeError:
            pass
        deadline = time.monotonic() + self.timeout_seconds
        state = "completed"
        while process.poll() is None:
            if cancelled.is_set():
                state = "cancelled"
                subprocess.run(["docker", "rm", "--force", container_name], capture_output=True)
                break
            if time.monotonic() >= deadline:
                state = "timeout"
                subprocess.run(["docker", "rm", "--force", container_name], capture_output=True)
                break
            cancelled.wait(0.05)
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        for thread in threads:
            thread.join(timeout=5)
        if state == "completed" and process.returncode != 0:
            state = "failed"
        return state, process.returncode, output

    @staticmethod
    def _evidence(container_name: str) -> dict[str, object]:
        inspected = DockerExecutor._simple(["docker", "inspect", container_name])
        item = json.loads(inspected.stdout)[0]
        host = item["HostConfig"]
        return {
            "cap_drop": host["CapDrop"],
            "memory": host["Memory"],
            "mount_count": len(item["Mounts"]),
            "nano_cpus": host["NanoCpus"],
            "network_mode": host["NetworkMode"],
            "pids_limit": host["PidsLimit"],
            "privileged": host["Privileged"],
            "readonly_rootfs": host["ReadonlyRootfs"],
            "security_opt": host["SecurityOpt"],
            "tmpfs": host["Tmpfs"],
            "user": item["Config"]["User"],
        }

    def execute(
        self,
        source_path: Path,
        profile_id: str,
        *,
        execution_id: str | None = None,
    ) -> ExecutionResult:
        resolved_id = execution_id or f"exec_{uuid4().hex}"
        arguments = self.policy.create_arguments(resolved_id, profile_id)
        container_name = f"secureeval-{resolved_id}"
        cancelled = threading.Event()
        with self._lock:
            if resolved_id in self._active:
                raise ValueError("execution identifier is already active")
            self._active[resolved_id] = cancelled
        staging = self.execution_root / resolved_id
        cleanup_state = "completed"
        state = "failed"
        exit_code: int | None = None
        output = _BoundedOutput(self.output_limit)
        evidence: dict[str, object] = {}
        container_created = False
        try:
            staged_source = staging / "source"
            shutil.copytree(source_path.resolve(), staged_source)
            self._simple(arguments)
            container_created = True
            evidence = self._evidence(container_name)
            state, exit_code, output = self._attached(
                container_name, cancelled, staged_source
            )
        finally:
            if container_created:
                removed = subprocess.run(
                    ["docker", "rm", "--force", container_name],
                    capture_output=True,
                    text=True,
                )
                if removed.returncode != 0 and "No such container" not in removed.stderr:
                    cleanup_state = "failed"
                    state = "failed"
            if staging.exists():
                shutil.rmtree(staging, onexc=_remove_readonly)
            with self._lock:
                self._active.pop(resolved_id, None)
        return ExecutionResult(
            execution_id=resolved_id,
            state=state,
            exit_code=exit_code,
            stdout=bytes(output.stdout).decode("utf-8", errors="replace"),
            stderr=bytes(output.stderr).decode("utf-8", errors="replace"),
            output_truncated=output.truncated,
            cleanup_state=cleanup_state,
            policy_id=POLICY_ID,
            image_digest=PINNED_IMAGE,
            policy_evidence=evidence,
        )