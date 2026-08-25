import { createSecureEvalClient } from "./client";
import type { Run } from "../contracts/api-v1";

const client = createSecureEvalClient({ baseUrl: "http://127.0.0.1:8000" });

const created: Promise<Run> = client.createRun({
  mode: "benchmark",
  task_id: "task_demo_001",
  scan_categories: ["injection"],
  strategies: ["vulnerability_specific_v1"],
});
const read: Promise<Run> = client.getRun("run_opaque");
const started: Promise<Run> = client.startRun("run_opaque");
const cancelled: Promise<Run> = client.cancelRun("run_opaque");

void [created, read, started, cancelled];
