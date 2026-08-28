from collections.abc import Mapping


DEFAULT_API_TOKEN = "sk-demo-hardcoded-token"


def get_api_token(env: Mapping[str, str]) -> str:
    return env.get("SECUREEVAL_SAMPLE_TOKEN", DEFAULT_API_TOKEN)
