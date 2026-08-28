import { useLiveRun } from "../useLiveRun";
import type { EvaluationKind, RunReport, ScanCategoryId, ScoreBasis } from "../contracts/api-v1";

const evaluation: EvaluationKind = "custom_prompt_smoke";
const score: ScoreBasis = "static_smoke";
declare const report: RunReport;
declare const liveRun: ReturnType<typeof useLiveRun>;
const startCustomPrompt: (
  prompt: string,
  scanCategories: ScanCategoryId[],
) => Promise<string | null> = liveRun.startCustomPrompt;

void [evaluation, score, report.generation_usage, startCustomPrompt];
