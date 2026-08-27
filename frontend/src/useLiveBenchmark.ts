import { useCallback, useEffect, useMemo, useState } from "react";

import { createSecureEvalClient } from "./api/client";
import type {
  RunProgress,
  RunReport,
  ScanCategoryId,
  StrategyId,
} from "./contracts/api-v1";

const POLL_INTERVAL_MS = 400;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The SecureEval API request failed.";
}

export function useLiveBenchmark(initialRunId: string | null) {
  const client = useMemo(
    () =>
      createSecureEvalClient({
        baseUrl:
          import.meta.env.VITE_SECUREEVAL_API_URL ??
          "http://127.0.0.1:8000",
      }),
    [],
  );
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(Boolean(initialRunId));

  const refresh = useCallback(
    async (id: string) => {
      const nextProgress = await client.getProgress(id);
      setProgress(nextProgress);
      if (nextProgress.status === "completed") {
        const nextReport = await client.getReport(id);
        setReport(nextReport);
        setBusy(false);
      } else if (
        nextProgress.status === "failed" ||
        nextProgress.status === "cancelled"
      ) {
        setBusy(false);
      } else {
        setBusy(true);
      }
      return nextProgress;
    },
    [client],
  );

  useEffect(() => {
    if (!runId || report?.run_id === runId) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const next = await refresh(runId);
        if (
          active &&
          next.status !== "completed" &&
          next.status !== "failed" &&
          next.status !== "cancelled"
        ) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (caught) {
        if (active) {
          setError(errorMessage(caught));
          setBusy(false);
        }
      }
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [refresh, report?.run_id, runId]);

  const start = useCallback(
    async (taskId: string, scanCategories: ScanCategoryId[]) => {
      setError(null);
      setReport(null);
      setProgress(null);
      setBusy(true);
      try {
        const created = await client.createRun({
          mode: "benchmark",
          task_id: taskId,
          scan_categories: scanCategories,
          strategies: ["vulnerability_specific_v1"],
        });
        setRunId(created.run_id);
        setProgress({
          run_id: created.run_id,
          status: created.status,
          stage: "queued",
          completed_stages: [],
          current_strategy: null,
        });
        await client.startRun(created.run_id);
        await refresh(created.run_id);
        return created.run_id;
      } catch (caught) {
        setError(errorMessage(caught));
        setBusy(false);
        return null;
      }
    },
    [client, refresh],
  );

  const configure = useCallback(
    async (strategies: StrategyId[]) => {
      if (!runId) return false;
      setError(null);
      setBusy(true);
      try {
        await client.configureStrategies(runId, strategies);
        await refresh(runId);
        return true;
      } catch (caught) {
        setError(errorMessage(caught));
        setBusy(false);
        return false;
      }
    },
    [client, refresh, runId],
  );

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      await client.cancelRun(runId);
      await refresh(runId);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }, [client, refresh, runId]);

  const reset = useCallback(() => {
    setRunId(null);
    setProgress(null);
    setReport(null);
    setError(null);
    setBusy(false);
  }, []);

  return {
    runId,
    progress,
    report,
    error,
    busy,
    start,
    configure,
    cancel,
    reset,
  };
}
