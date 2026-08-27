/**
 * Phase 1 public API boundary described by API_SPEC.md.
 * The Phase 0 taxonomy imports its identifier types; API client calls remain deferred until Phase 7.
 * These public shapes match the authoritative Pydantic models.
 */

export type Mode = "benchmark" | "custom_prompt" | "upload";
export type ModeLabel =
  | "Benchmark"
  | "Exploratory \u2014 Custom Prompt"
  | "Exploratory \u2014 Uploaded Code";


export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ToolStatus =
  | "completed"
  | "failed"
  | "timeout"
  | "unavailable"
  | "cancelled";

export type RunStage =
  | "queued"
  | "baseline_testing"
  | "baseline_scanning"
  | "awaiting_strategy"
  | "repairing"
  | "repaired_testing"
  | "repaired_scanning"
  | "reviewing"
  | "reporting"
  | "completed"
  | "failed"
  | "cancelled";

export type FailureCode =
  | "validation_error"
  | "upload_rejected"
  | "sandbox_timeout"
  | "tool_error"
  | "model_error"
  | "schema_invalid"
  | "internal_error";

export type ScanCategoryId =
  | "injection"
  | "authentication_authorization"
  | "secrets"
  | "input_validation"
  | "dependency_configuration";

export type StrategyId =
  | "vulnerability_specific_v1"
  | "scanner_feedback_v1"
  | "test_feedback_v1";

export interface ScanCategoryDefinition {
  id: ScanCategoryId;
  title: string;
  icon: string;
  desc: string;
}

export interface StrategyMetaDefinition {
  title: string;
  sub: string;
  icon: string;
  desc: string;
  prompt: string;
}

export interface HealthResponse {
  schema_version: "1.0";
  status: "ok";
  service: "secureeval-api";
}

export interface ErrorEnvelope {
  error: {
    code: FailureCode | string;
    message: string;
    request_id: string;
  };
}

export interface TaskCatalogItem {
  task_id: string;
  corpus_version: string;
  title: string;
  description: string;
  expected_behavior: string;
  domain: string;
  complexity: "low" | "medium" | "high";
  active: boolean;
}

export interface TaskCatalog {
  schema_version: "1.0";
  corpus_version: string;
  tasks: TaskCatalogItem[];
}

export type UploadPurpose = "custom_prompt_context" | "uploaded_code";

export interface UploadReceipt {
  schema_version: "1.0";
  upload_id: string;
  purpose: UploadPurpose;
  file_count: number;
  total_bytes: number;
  content_hash: string;
  retention_class: "exploratory_24h";
  created_at: string;
  expires_at: string;
}

export interface RunCreate {
  mode: Mode;
  task_id?: string;
  upload_id?: string;
  custom_prompt?: string;
  scan_categories: ScanCategoryId[];
  strategies: StrategyId[] | ["run_all"];
}

export interface AttemptSummary {
  attempt_id: string;
  strategy_id: StrategyId;
  status: JobStatus;
  failure_code: FailureCode | string | null;
}

export interface Run {
  schema_version: "1.0";
  run_id: string;
  mode: Mode;
  mode_label: ModeLabel;
  official_eligible: boolean;
  status: JobStatus;
  attempt_summaries: AttemptSummary[];
  manifest_hash: string;
  created_at: string;
  updated_at: string;
  failure_code: FailureCode | string | null;
  failure_message: string | null;
}

export interface FindingSummary {
  finding_id: string;
  category: ScanCategoryId;
  tool: "bandit" | "semgrep" | "deterministic_rule";
  rule_id: string;
  severity: "low" | "medium" | "high";
  file_ref: string;
  line?: number;
  message: string;
}

export interface AssessmentSummary {
  selected_scan_categories: ScanCategoryId[];
  skipped_scan_categories: ScanCategoryId[];
  findings: FindingSummary[];
  functional_tests: {
    passed: number;
    failed: number;
    skipped: number;
    status: "completed" | "failed" | "unavailable";
  };
  coverage_limitations: string[];
}

export interface MetricRecord {
  metric_version: string;
  security_effectiveness: number;
  functionality_preservation: number;
  introduced_findings: number;
  token_count: number;
  cost_usd: number;
  latency_ms: number;
  efficiency: number;
}

export interface ReviewerResult {
  schema_version: "1.0";
  verdict: "accept" | "concern" | "reject" | "insufficient_evidence";
  confidence: "low" | "medium" | "high";
  observations: Array<{ evidence_ref: string; text: string }>;
  limitations: string[];
}

export interface InterpretationResult {
  schema_version: "1.0";
  headline: string;
  summary: string;
  comparisons: Array<{ strategy_id: StrategyId; text: string }>;
  caveats: string[];
  source: "validated_llm" | "deterministic_fallback";
}

export interface AttemptReport {
  attempt_id: string;
  strategy_id: StrategyId;
  status: JobStatus;
  baseline: AssessmentSummary;
  candidate?: AssessmentSummary;
  metric?: MetricRecord;
  reviewer?: ReviewerResult;
  artifact_refs: string[];
  limitations: string[];
}

export interface LegacyRunReport {
  schema_version: "1.0";
  run: Run;
  attempts: AttemptReport[];
  best_overall_attempt_id?: string;
  best_efficiency_attempt_id?: string;
  interpretation?: InterpretationResult;
  exploratory_label?: "Exploratory — not included in benchmark statistics";
  configuration_id: string;
  corpus_version?: string;
  metric_version: string;
  limitations: string[];
}

export interface Finding {
  finding_id: string;
  scanner: "bandit" | "semgrep";
  rule_id: string;
  category: ScanCategoryId;
  severity: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high" | null;
  filename: string;
  line_start: number;
  line_end: number;
  message: string;
}

export interface TestExecution {
  status: ToolStatus;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  output: string;
  output_truncated: boolean;
}

export interface LlmUsage {
  source: "llm" | "local_fallback";
  provider: string | null;
  model: string | null;
  status: ToolStatus | "invalid_response";
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  retries: number;
}

export interface StrategyMetrics {
  findings_before: number;
  findings_after: number;
  fixed_count: number;
  security_score: number;
  functionality_score: number;
  overall_score: number;
  efficiency_score: number;
}

export interface StrategyResult {
  attempt_id: string;
  strategy_id: StrategyId;
  status: JobStatus;
  repaired_code: string;
  repair_summary: string;
  limitations: string[];
  repaired_findings: Finding[];
  repaired_tests: TestExecution;
  llm_usage: LlmUsage;
  review: string;
  metrics: StrategyMetrics;
}

export interface RunProgress {
  run_id: string;
  status: JobStatus;
  stage: RunStage;
  completed_stages: RunStage[];
  current_strategy: StrategyId | null;
}

export interface RunReport {
  schema_version: "1.0";
  run_id: string;
  status: JobStatus;
  mode: Mode;
  baseline_source: string;
  baseline_findings: Finding[];
  baseline_tests: TestExecution;
  strategy_results: StrategyResult[];
  best_overall: StrategyId | null;
  best_efficiency: StrategyId | null;
  explanation: string;
  explanation_source: "llm" | "local_fallback";
  limitations: string[];
  created_at: string;
}

export interface OfficialAggregate {
  schema_version: "1.0";
  corpus_version: string;
  configuration_id: string;
  metric_version: string;
  qualifying_run_count: number;
  qualifying_attempt_count: number;
  exclusion_statement: string;
}
