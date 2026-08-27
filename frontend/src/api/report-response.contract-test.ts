import type { RunProgress, RunReport } from "../contracts/api-v1";

const progressFixture = {
  run_id: "run_00000000000000000000000000000000",
  status: "running",
  stage: "repaired_scanning",
  completed_stages: [
    "baseline_testing",
    "baseline_scanning",
    "repairing",
    "repaired_testing",
  ],
  current_strategy: "scanner_feedback_v1",
} as const satisfies RunProgress;

const reportFixture = {
  schema_version: "1.0",
  run_id: "run_00000000000000000000000000000000",
  status: "completed",
  mode: "benchmark",
  baseline_source: "def lookup(): pass\n",
  baseline_findings: [
    {
      finding_id: "finding_00000000000000000000000000000000",
      scanner: "bandit",
      rule_id: "B608",
      category: "injection",
      severity: "medium",
      confidence: "medium",
      filename: "app.py",
      line_start: 5,
      line_end: 5,
      message: "Possible SQL injection vector.",
    },
  ],
  baseline_tests: {
    status: "completed",
    passed: 2,
    failed: 0,
    skipped: 0,
    duration_ms: 18,
    output: "2 passed",
    output_truncated: false,
  },
  strategy_results: [
    {
      attempt_id: "attempt_00000000000000000000000000000000",
      strategy_id: "scanner_feedback_v1",
      status: "completed",
      repaired_code: "def lookup(): pass\n",
      repair_summary: "Parameterized the SQL query.",
      limitations: ["Controlled T-01 repair."],
      repaired_findings: [],
      repaired_tests: {
        status: "completed",
        passed: 2,
        failed: 0,
        skipped: 0,
        duration_ms: 17,
        output: "2 passed",
        output_truncated: false,
      },
      llm_usage: {
        source: "local_fallback",
        provider: null,
        model: null,
        status: "completed",
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
        latency_ms: 1,
        retries: 0,
      },
      review: "Configured checks passed; this is not a security guarantee.",
      metrics: {
        findings_before: 2,
        findings_after: 0,
        fixed_count: 2,
        security_score: 100,
        functionality_score: 100,
        overall_score: 100,
        efficiency_score: 100,
      },
    },
  ],
  best_overall: "scanner_feedback_v1",
  best_efficiency: "scanner_feedback_v1",
  explanation: "The recorded repair removed both configured findings.",
  explanation_source: "local_fallback",
  limitations: ["Static analysis is not a security guarantee."],
  created_at: "2026-08-27T00:00:00Z",
} as const satisfies RunReport;

void [progressFixture, reportFixture];
