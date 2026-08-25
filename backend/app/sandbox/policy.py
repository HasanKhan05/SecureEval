import re
from dataclasses import dataclass, field

PINNED_IMAGE = "python@sha256:31da4cb527055e4e3d7e9e006dffe9329f84ebea79eaca0a1f1c27ce61e40ca5"
POLICY_ID = "sandbox-policy-v1"
EXECUTION_ID_PATTERN = re.compile(r"^exec_[0-9a-f]{32}$")

SOURCE_BOOTSTRAP_SCRIPT = r'''
import pathlib, sys, tarfile
source = pathlib.Path("/workspace/source")
source.mkdir(mode=0o700)
with tarfile.open(fileobj=sys.stdin.buffer, mode="r|*") as archive:
    for member in archive:
        target = (source / member.name).resolve()
        if not target.is_relative_to(source) or not (member.isdir() or member.isfile()):
            raise RuntimeError("invalid staged source")
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True, mode=0o700)
        else:
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            incoming = archive.extractfile(member)
            if incoming is None:
                raise RuntimeError("missing staged source")
            with target.open("wb") as output:
                output.write(incoming.read())
for path in sorted(source.rglob("*"), reverse=True):
    path.chmod(0o555 if path.is_dir() else 0o444)
source.chmod(0o555)
'''.strip()

POLICY_PROBE_SCRIPT = r'''
import json, os, pathlib
source = pathlib.Path("/workspace/source")
def can_write(path):
    try:
        path.write_text("probe", encoding="utf-8")
        path.unlink()
        return True
    except OSError:
        return False
status = pathlib.Path("/proc/self/status").read_text()
cap_eff = next(line.split()[1] for line in status.splitlines() if line.startswith("CapEff:"))
routes = pathlib.Path("/proc/net/route").read_text().splitlines()[1:]
result = {
    "uid": os.getuid(),
    "gid": os.getgid(),
    "cap_eff": cap_eff,
    "non_loopback_routes": len(routes),
    "root_writable": can_write(pathlib.Path("/phase2-root-probe")),
    "workspace_writable": can_write(pathlib.Path("/workspace/probe")),
    "source_writable": can_write(source / "source.py"),
}
print(json.dumps(result, sort_keys=True, separators=(",", ":")))
'''.strip()


@dataclass(frozen=True)
class CommandProfile:
    profile_id: str
    script: str


@dataclass(frozen=True)
class SandboxPolicy:
    image: str = PINNED_IMAGE
    profiles: dict[str, CommandProfile] = field(
        default_factory=lambda: {
            "phase2_policy_probe": CommandProfile(
                profile_id="phase2_policy_probe", script=POLICY_PROBE_SCRIPT
            )
        }
    )

    def __post_init__(self) -> None:
        if self.image != PINNED_IMAGE:
            raise ValueError("sandbox image is not the approved digest")

    def container_script(self, profile: CommandProfile) -> str:
        return f"{SOURCE_BOOTSTRAP_SCRIPT}\n{profile.script}"

    def create_arguments(self, execution_id: str, profile_id: str) -> list[str]:
        if not EXECUTION_ID_PATTERN.fullmatch(execution_id):
            raise ValueError("invalid execution identifier")
        profile = self.profiles.get(profile_id)
        if profile is None:
            raise ValueError("unknown command profile")
        return [
            "docker", "create", "--interactive",
            "--name", f"secureeval-{execution_id}",
            "--label", f"secureeval.execution_id={execution_id}",
            "--platform", "linux/amd64",
            "--network", "none",
            "--user", "65532:65532",
            "--cap-drop", "ALL",
            "--security-opt", "no-new-privileges:true",
            "--read-only",
            "--pids-limit", "64",
            "--memory", "512m",
            "--cpus", "1.0",
            "--tmpfs", "/workspace:rw,noexec,nosuid,nodev,size=67108864,uid=65532,gid=65532,mode=0700",
            "--env", "PYTHONDONTWRITEBYTECODE=1",
            "--env", "PYTHONUNBUFFERED=1",
            self.image,
            "python", "-I", "-B", "-c", self.container_script(profile),
        ]
