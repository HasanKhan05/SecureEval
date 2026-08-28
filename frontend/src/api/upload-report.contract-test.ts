import { useLiveRun } from "../useLiveRun";
import type { RunReport, ScanCategoryId } from "../contracts/api-v1";

const uploadReport = {
  schema_version: "1.0",
  run_id: "run_00000000000000000000000000000000",
  status: "completed",
  mode: "upload",
  evaluation_kind: "upload_static",
  baseline_source: "print('uploaded')\n",
  baseline_syntax: {
    status: "completed",
    valid: true,
    line: null,
    column: null,
    message: "Syntax valid.",
  },
  baseline_findings: [],
  baseline_scan_status: "completed",
  baseline_tests: {
    status: "unavailable",
    passed: 0,
    failed: 0,
    skipped: 0,
    duration_ms: 0,
    output: "Functional tests unavailable — uploaded code was not executed.",
    output_truncated: false,
  },
  generation_usage: null,
  strategy_results: [
    {
      attempt_id: "attempt_00000000000000000000000000000000",
      strategy_id: "vulnerability_specific_v1",
      status: "completed",
      repaired_code: "print('repaired')\n",
      repair_summary: "Replaced the unsafe operation.",
      limitations: ["Functional tests were not executed."],
      repaired_findings: [],
      repaired_scan_status: "completed",
      repaired_syntax: {
        status: "completed",
        valid: true,
        line: null,
        column: null,
        message: "Syntax valid.",
      },
      repaired_tests: {
        status: "unavailable",
        passed: 0,
        failed: 0,
        skipped: 0,
        duration_ms: 0,
        output: "Functional tests unavailable — uploaded code was not executed.",
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
        latency_ms: 0,
        retries: 0,
      },
      review: "Static evidence only; this is not a security guarantee.",
      metrics: {
        score_basis: "static_only",
        findings_before: 1,
        findings_after: 0,
        fixed_count: 1,
        security_score: 100,
        functionality_score: null,
        overall_score: 100,
        efficiency_score: 100,
      },
    },
  ],
  best_overall: "vulnerability_specific_v1",
  best_efficiency: "vulnerability_specific_v1",
  explanation: "Static analysis completed for uploaded source.",
  explanation_source: "local_fallback",
  limitations: ["Uploaded source was not executed."],
  created_at: "2026-08-27T00:00:00Z",
} as const satisfies RunReport;

declare const liveRun: ReturnType<typeof useLiveRun>;
const startBenchmark: (
  taskId: string,
  scanCategories: ScanCategoryId[],
) => Promise<string | null> = liveRun.startBenchmark;
const startUpload: (
  sourceCode: string,
  fileName: string,
  scanCategories: ScanCategoryId[],
) => Promise<string | null> = liveRun.startUpload;

void [uploadReport, startBenchmark, startUpload];
