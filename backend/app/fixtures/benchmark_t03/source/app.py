def build_command(action: str, target: str) -> list[str]:
    return ["sh", "-c", f"git {action} {target}"]
