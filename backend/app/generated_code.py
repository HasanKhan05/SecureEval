from __future__ import annotations

from app.llm.client import LlmClient
from app.llm.contracts import GeneratedProgram, LlmResult
from app.schemas import SyntaxValidation
from app.static_evidence import validate_python_syntax


class GeneratedCodeRejected(ValueError):
    pass


def generate_program(
    prompt: str,
    client: LlmClient,
) -> LlmResult[GeneratedProgram]:
    return client.complete(
        GeneratedProgram,
        [
            {
                "role": "system",
                "content": (
                    "Return exactly one Python module in the required code field. "
                    "Do not include Markdown, prose, tests, dependency manifests, "
                    "or additional files. Use only the Python standard library."
                ),
            },
            {"role": "user", "content": prompt},
        ],
    )


def validate_generated_python(source: str) -> SyntaxValidation:
    if "```" in source:
        raise GeneratedCodeRejected("markdown fences are not accepted")
    if "\x00" in source:
        raise GeneratedCodeRejected("nul bytes are not accepted")
    syntax = validate_python_syntax(source)
    if not syntax.valid:
        raise GeneratedCodeRejected(f"syntax validation failed: {syntax.message}")
    return syntax