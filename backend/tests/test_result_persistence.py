import importlib.util

import pytest
from sqlalchemy import create_engine, func, inspect, select

from app import schemas
from app.database import upgrade_database
from app.models import FindingRecord, LlmCallRecord, TestExecutionRecord


def test_functional_result_migration_creates_normalized_tables(
    database_url: str,
) -> None:
    upgrade_database(database_url)

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert {
            "findings",
            "test_executions",
            "llm_calls",
            "run_reports",
        } <= set(inspector.get_table_names())

        finding_columns = {
            item["name"] for item in inspector.get_columns("findings")
        }
        assert {
            "finding_id",
            "run_id",
            "attempt_id",
            "stage",
            "scanner",
            "rule_id",
            "category",
            "severity",
            "confidence",
            "filename",
            "line_start",
            "line_end",
            "message",
        } == finding_columns

        report_columns = {
            item["name"] for item in inspector.get_columns("run_reports")
        }
        assert report_columns == {
            "run_id",
            "schema_version",
            "report_json",
            "best_overall",
            "best_efficiency",
            "created_at",
        }
    finally:
        engine.dispose()

@pytest.fixture
def completed_report() -> schemas.RunReport:
    report_type = getattr(schemas, "RunReport", None)
    assert report_type is not None

    report = report_type.model_validate(
        {
            "run_id": "run_" + "a" * 32,
            "status": "completed",
            "mode": "benchmark",
            "baseline_source": "def lookup(): pass\n",
            "baseline_findings": [
                {
                    "finding_id": "finding_" + "b" * 32,
                    "scanner": "bandit",
                    "rule_id": "B608",
                    "category": "injection",
                    "severity": "medium",
                    "confidence": "medium",
                    "filename": "source/app.py",
                    "line_start": 5,
                    "line_end": 5,
                    "message": "Possible SQL injection vector.",
                }
            ],
            "baseline_tests": {
                "status": "completed",
                "passed": 2,
                "failed": 0,
                "skipped": 0,
                "duration_ms": 18,
                "output": "2 passed",
                "output_truncated": False,
            },
            "strategy_results": [
                {
                    "attempt_id": "attempt_" + "c" * 32,
                    "strategy_id": "vulnerability_specific_v1",
                    "status": "completed",
                    "repaired_code": "def lookup(): pass\n",
                    "repair_summary": "Parameterized the SQL query.",
                    "limitations": [],
                    "repaired_findings": [],
                    "repaired_tests": {
                        "status": "completed",
                        "passed": 2,
                        "failed": 0,
                        "skipped": 0,
                        "duration_ms": 17,
                        "output": "2 passed",
                        "output_truncated": False,
                    },
                    "llm_usage": {
                        "source": "local_fallback",
                        "provider": None,
                        "model": None,
                        "status": "completed",
                        "input_tokens": 0,
                        "output_tokens": 0,
                        "estimated_cost_usd": 0,
                        "latency_ms": 1,
                        "retries": 0,
                    },
                    "review": "Fallback repair passed all configured checks.",
                    "metrics": {
                        "findings_before": 1,
                        "findings_after": 0,
                        "fixed_count": 1,
                        "security_score": 100,
                        "functionality_score": 100,
                        "overall_score": 100,
                        "efficiency_score": 100,
                    },
                }
            ],
            "best_overall": "vulnerability_specific_v1",
            "best_efficiency": "vulnerability_specific_v1",
            "explanation": "The repair removed the configured finding.",
            "explanation_source": "local_fallback",
            "limitations": ["Static analysis is not a security guarantee."],
            "created_at": "2026-08-27T00:00:00Z",
        }
    )

    return report


def test_run_report_contract_preserves_real_evidence(
    completed_report: schemas.RunReport,
) -> None:
    assert completed_report.baseline_findings[0].rule_id == "B608"
    assert completed_report.strategy_results[0].metrics.fixed_count == 1
    assert completed_report.explanation_source == "local_fallback"

def test_report_and_normalized_evidence_survive_new_database_session(
    client,
    benchmark_run_payload: dict[str, object],
    completed_report: schemas.RunReport,
) -> None:
    reports_spec = importlib.util.find_spec("app.reports")
    assert reports_spec is not None
    reports = importlib.util.module_from_spec(reports_spec)
    assert reports_spec.loader is not None
    reports_spec.loader.exec_module(reports)

    created = client.post("/api/v1/runs", json=benchmark_run_payload).json()
    strategy = completed_report.strategy_results[0].model_copy(
        update={"attempt_id": created["attempt_summaries"][0]["attempt_id"]}
    )
    report = completed_report.model_copy(
        update={"run_id": created["run_id"], "strategy_results": [strategy]}
    )
    session_factory = client.app.state.session_factory

    with session_factory() as session:
        reports.save_report(session, report)
    with session_factory() as restarted_session:
        restored = reports.load_report(restarted_session, report.run_id)
        finding_count = restarted_session.scalar(
            select(func.count()).select_from(FindingRecord)
        )
        test_count = restarted_session.scalar(
            select(func.count()).select_from(TestExecutionRecord)
        )
        llm_count = restarted_session.scalar(
            select(func.count()).select_from(LlmCallRecord)
        )

    assert restored == report
    assert finding_count == 1
    assert test_count == 2
    assert llm_count == 1
