import type {
  ScanCategoryDefinition,
  StrategyId,
  StrategyMetaDefinition,
} from "./contracts/api-v1";

export const SCAN_CATEGORY_IDS = [
  "injection",
  "authentication_authorization",
  "secrets",
  "input_validation",
  "dependency_configuration",
] as const satisfies readonly ScanCategoryDefinition["id"][];

export const STRATEGY_IDS = [
  "vulnerability_specific_v1",
  "scanner_feedback_v1",
  "test_feedback_v1",
] as const satisfies readonly StrategyId[];

export const SCAN_CATEGORIES = [
  { id: "injection", title: "Injection", icon: "⬡", desc: "Unsafe construction of queries, commands, or interpreters from untrusted input." },
  { id: "authentication_authorization", title: "Authentication & Authorization", icon: "◎", desc: "Missing, weak, or bypassable identity and permission controls." },
  { id: "secrets", title: "Secrets Exposure", icon: "◈", desc: "Credentials, API keys, tokens, or other sensitive values exposed in source or configuration." },
  { id: "input_validation", title: "Input Validation", icon: "◉", desc: "Untrusted input that is insufficiently validated, normalized, or constrained." },
  { id: "dependency_configuration", title: "Dependency & Configuration", icon: "◫", desc: "Risky dependencies, insecure defaults, or unsafe application configuration." },
] as const satisfies readonly ScanCategoryDefinition[];

export const STRATEGY_META = {
  vulnerability_specific_v1: {
    icon: "⬡",
    title: "Vulnerability-Specific Repair",
    sub: "Targeted remediation",
    desc: "Uses the task or code together with the selected normalized issue facts.",
    prompt: '"Fix the selected normalized security issues while preserving all existing functionality."',
  },
  scanner_feedback_v1: {
    icon: "◎",
    title: "Scanner-Feedback Repair",
    sub: "Tool-guided repair",
    desc: "Uses the task or code together with compact normalized Bandit and Semgrep findings.",
    prompt: '"Fix the normalized scanner findings while preserving all existing functionality."',
  },
  test_feedback_v1: {
    icon: "◈",
    title: "Test-Feedback Repair",
    sub: "Functional-test guided",
    desc: "Uses the task or code together with failing public functional-test output.",
    prompt: '"Use the failing public functional-test output to repair the implementation while preserving functionality."',
  },
} as const satisfies Record<StrategyId, StrategyMetaDefinition>;