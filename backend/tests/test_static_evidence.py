from app.scoring import StaticEvidenceSnapshot, score_static_strategy
from app.static_evidence import unavailable_functional_tests, validate_python_syntax


def test_syntax_validation_never_executes_source() -> None:
    marker = "raise RuntimeError('must never execute')\n"

    result = validate_python_syntax(marker)

    assert result.status == "completed"
    assert result.valid is True


def test_syntax_validation_reports_location_without_source_execution() -> None:
    result = validate_python_syntax("def broken(:\n    pass\n")

    assert result.status == "failed"
    assert result.valid is False
    assert result.line == 1
    assert result.message


def test_unavailable_functional_tests_are_explicit() -> None:
    result = unavailable_functional_tests()

    assert result.status == "unavailable"
    assert result.passed == result.failed == result.skipped == 0
    assert "not executed" in result.output.lower()


def test_static_score_uses_only_completed_syntax_and_scan_evidence() -> None:
    metrics = score_static_strategy(
        StaticEvidenceSnapshot(2, "completed", True),
        StaticEvidenceSnapshot(0, "completed", True, cost_usd=0.01),
    )

    assert metrics.score_basis == "static_only"
    assert metrics.security_score == 100
    assert metrics.functionality_score is None
    assert metrics.overall_score == 100


def test_static_score_is_zero_when_rescan_is_unavailable() -> None:
    metrics = score_static_strategy(
        StaticEvidenceSnapshot(2, "completed", True),
        StaticEvidenceSnapshot(0, "unavailable", True),
    )

    assert metrics.overall_score == 0
    assert metrics.efficiency_score == 0
