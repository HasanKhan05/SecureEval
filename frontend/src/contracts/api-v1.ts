/**
 * Phase 1 public API boundary described by API_SPEC.md.
 * It remains deliberately unimported by the preserved Figma UI until Phase 7.
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

export interface UploadReceipt {
  schema_version: "1.0";
  upload_id: string;
  file_name: string;
  accepted_file_count: number;
  content_hash: string;
  status: "accepted";
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

export interface RunReport {
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

export interface OfficialAggregate {
  schema_version: "1.0";
  corpus_version: string;
  configuration_id: string;
  metric_version: string;
  qualifying_run_count: number;
  qualifying_attempt_count: number;
  exclusion_statement: string;
}
