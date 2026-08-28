from source.app import build_command


def test_build_command_contains_requested_action() -> None:
    assert "status" in " ".join(build_command("status", "repository"))


def test_build_command_contains_target_as_argument() -> None:
    assert "report.txt" in " ".join(build_command("show", "report.txt"))
