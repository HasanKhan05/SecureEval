import type { Run } from "../contracts/api-v1";

const backendResponseFixture = {
  schema_version: "1.0",
  run_id: "run_00000000000000000000000000000000",
  mode: "custom_prompt",
  mode_label: "Exploratory — Custom Prompt",
  official_eligible: false,
  status: "queued",
  attempt_summaries: [
    {
      attempt_id: "attempt_00000000000000000000000000000000",
      strategy_id: "vulnerability_specific_v1",
      status: "queued",
      failure_code: null,
    },
  ],
  manifest_hash: "sha256:fixture",
  created_at: "2026-08-25T00:00:00Z",
  updated_at: "2026-08-25T00:00:00Z",
  failure_code: null,
  failure_message: null,
} as const satisfies Run;

void backendResponseFixture;
