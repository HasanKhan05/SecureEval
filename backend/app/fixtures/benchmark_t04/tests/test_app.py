from source.app import get_api_token


def test_get_api_token_reads_injected_environment() -> None:
    assert get_api_token({"SECUREEVAL_SAMPLE_TOKEN": "configured-token"}) == "configured-token"


def test_get_api_token_accepts_another_injected_value() -> None:
    assert get_api_token({"SECUREEVAL_SAMPLE_TOKEN": "rotated-token"}) == "rotated-token"