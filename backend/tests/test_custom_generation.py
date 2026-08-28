import importlib
import importlib.util
import json

import httpx
import pytest

from app.llm.client import LlmClient


def _generation_module():
    assert importlib.util.find_spec("app.generated_code") is not None
    return importlib.import_module("app.generated_code")


def test_custom_generation_requires_real_api_configuration() -> None:
    module = _generation_module()
    client = LlmClient(base_url="https://api.openai.com/v1", api_key="", model="")

    result = module.generate_program("Create a Python command line utility.", client)

    assert result.value is None
    assert result.source == "llm"
    assert result.status == "unavailable"


def test_custom_generation_uses_strict_code_only_schema_and_real_usage() -> None:
    module = _generation_module()

    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        schema = payload["response_format"]["json_schema"]
        assert schema["strict"] is True
        assert schema["schema"]["properties"] == {
            "code": {"maxLength": 100000, "minLength": 1, "title": "Code", "type": "string"}
        }
        assert schema["schema"]["additionalProperties"] is False
        assert "Return exactly one Python module" in payload["messages"][0]["content"]
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": json.dumps({"code": "print('real api')\n"})}}],
                "usage": {"prompt_tokens": 21, "completion_tokens": 9},
            },
        )

    client = LlmClient(
        base_url="https://api.openai.com/v1",
        api_key="environment-key",
        model="configured-model",
        transport=httpx.MockTransport(handler),
    )

    result = module.generate_program("Create a Python command line utility.", client)

    assert result.status == "completed"
    assert result.value.code == "print('real api')\n"
    assert result.input_tokens == 21
    assert result.output_tokens == 9
    assert result.model == "configured-model"


@pytest.mark.parametrize(
    ("source", "reason"),
    [
        ("```python\nprint('x')\n```", "markdown"),
        ("def broken(:\n    pass\n", "syntax"),
        ("x = 1\x00\n", "nul"),
    ],
)
def test_generated_python_rejects_non_code_payloads(source: str, reason: str) -> None:
    module = _generation_module()

    with pytest.raises(module.GeneratedCodeRejected, match=reason):
        module.validate_generated_python(source)


def test_generated_python_accepts_one_valid_module() -> None:
    module = _generation_module()

    syntax = module.validate_generated_python("def answer() -> int:\n    return 42\n")

    assert syntax.valid is True
    assert syntax.status == "completed"
