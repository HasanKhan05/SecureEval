import pytest

from app.sandbox.policy import PINNED_IMAGE, SandboxPolicy


def test_policy_builds_exact_restricted_docker_create_arguments() -> None:
    policy = SandboxPolicy()
    execution_id = "exec_" + "a" * 32

    arguments = policy.create_arguments(execution_id, "phase2_policy_probe")

    assert arguments == [
        "docker",
        "create",
        "--interactive",
        "--name",
        f"secureeval-{execution_id}",
        "--label",
        f"secureeval.execution_id={execution_id}",
        "--platform",
        "linux/amd64",
        "--network",
        "none",
        "--user",
        "65532:65532",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--read-only",
        "--pids-limit",
        "64",
        "--memory",
        "512m",
        "--cpus",
        "1.0",
        "--tmpfs",
        "/workspace:rw,noexec,nosuid,nodev,size=67108864,uid=65532,gid=65532,mode=0700",
        "--env",
        "PYTHONDONTWRITEBYTECODE=1",
        "--env",
        "PYTHONUNBUFFERED=1",
        PINNED_IMAGE,
        "python",
        "-I",
        "-B",
        "-c",
        policy.container_script(policy.profiles["phase2_policy_probe"]),
    ]
    forbidden = {"--volume", "-v", "--mount", "--privileged", "--device"}
    assert forbidden.isdisjoint(arguments)
    assert all("docker.sock" not in item for item in arguments)


@pytest.mark.parametrize(
    "image",
    [
        "python:3.14.2-alpine",
        "python@sha256:not-a-digest",
        "evil.example/image@sha256:" + "A" * 64,
    ],
)
def test_policy_rejects_unpinned_or_unapproved_image(image: str) -> None:
    with pytest.raises(ValueError, match="approved digest"):
        SandboxPolicy(image=image)


def test_policy_rejects_unknown_profile_and_malformed_execution_id() -> None:
    policy = SandboxPolicy()

    with pytest.raises(ValueError, match="unknown command profile"):
        policy.create_arguments("exec_" + "a" * 32, "user-supplied")
    with pytest.raises(ValueError, match="invalid execution identifier"):
        policy.create_arguments("../../container", "phase2_policy_probe")
