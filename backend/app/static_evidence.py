import ast

from app.schemas import SyntaxValidation, TestExecution


def validate_python_syntax(source: str) -> SyntaxValidation:
    try:
        ast.parse(source, filename="uploaded_code.py", mode="exec")
    except SyntaxError as exc:
        return SyntaxValidation(
            status="failed",
            valid=False,
            line=max(1, exc.lineno or 1),
            column=max(1, exc.offset or 1),
            message=str(exc.msg)[:1000],
        )
    return SyntaxValidation(
        status="completed", valid=True, line=None, column=None, message="Syntax valid."
    )


def unavailable_functional_tests() -> TestExecution:
    return TestExecution(
        status="unavailable",
        passed=0,
        failed=0,
        skipped=0,
        duration_ms=0,
        output="Functional tests unavailable — uploaded code was not executed.",
        output_truncated=False,
    )
