import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSecureEvalClient } from "./api/client";
import type {
  RunProgress,
  RunReport,
  ScanCategoryId,
  StrategyId,
} from "./contracts/api-v1";

const POLL_INTERVAL_MS = 400;
const MAX_TRANSIENT_FAILURES = 4;

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The SecureEval API request failed.";
}

export function useLiveBenchmark(
  initialRunId: string | null,
  initialRequested = Boolean(initialRunId),
) {
  const client = useMemo(
    () =>
      createSecureEvalClient({
        baseUrl:
          import.meta.env.VITE_SECUREEVAL_API_URL ??
          "http://127.0.0.1:8000",
      }),
    [],
  );
  const generation = useRef(0);
  const [requested, setRequested] = useState(initialRequested);
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminalMessage, setTerminalMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(Boolean(initialRunId));

  useEffect(() => {
    if (!runId || report?.run_id === runId) return;

    const activeGeneration = ++generation.current;
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const isCurrent = () => active && generation.current === activeGeneration;
    const poll = async () => {
      try {
        const nextProgress = await client.getProgress(runId);
        if (!isCurrent() || nextProgress.run_id !== runId) return;
        setProgress(nextProgress);
        setError(null);
        failures = 0;

        if (nextProgress.status === "completed") {
          const nextReport = await client.getReport(runId);
          if (!isCurrent() || nextReport.run_id !== runId) return;
          setReport(nextReport);
          setBusy(false);
          return;
        }
        if (nextProgress.status === "failed") {
          const failedRun = await client.getRun(runId);
          if (!isCurrent() || failedRun.run_id !== runId) return;
          setTerminalMessage(
            failedRun.failure_message ?? "The local evaluator could not complete this run.",
          );
          setBusy(false);
          return;
        }
        if (nextProgress.status === "cancelled") {
          setTerminalMessage("This local run was cancelled.");
          setBusy(false);
          return;
        }
        setBusy(true);
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (caught) {
        if (!isCurrent()) return;
        failures += 1;
        setError(errorMessage(caught));
        if (failures < MAX_TRANSIENT_FAILURES) {
          timer = setTimeout(poll, POLL_INTERVAL_MS * failures);
        } else {
          setBusy(false);
        }
      }
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, report?.run_id, runId]);

  const start = useCallback(
    async (taskId: string, scanCategories: ScanCategoryId[]) => {
      const operation = ++generation.current;
      setRequested(true);
      setRunId(null);
      setError(null);
      setTerminalMessage(null);
      setReport(null);
      setProgress(null);
      setBusy(true);

      let created;
      try {
        created = await client.createRun({
          mode: "benchmark",
          task_id: taskId,
          scan_categories: scanCategories,
          strategies: ["vulnerability_specific_v1"],
        });
      } catch (caught) {
        if (generation.current === operation) {
          setError(errorMessage(caught));
          setBusy(false);
        }
        return null;
      }
      if (generation.current !== operation) return null;

      try {
        await client.startRun(created.run_id);
      } catch (caught) {
        try {
          const reconciled = await client.getRun(created.run_id);
          if (
            generation.current === operation &&
            (reconciled.status === "running" ||
              reconciled.status === "completed")
          ) {
            setRunId(created.run_id);
            setError(null);
            return created.run_id;
          }
          if (reconciled.status === "queued") {
            await client.cancelRun(created.run_id);
          }
        } catch {
          // Preserve the original start error when reconciliation is unavailable.
        }
        if (generation.current === operation) {
          setError(`The run could not be started. ${errorMessage(caught)}`);
          setBusy(false);
        }
        return null;
      }

      if (generation.current !== operation) return null;
      setRunId(created.run_id);
      setProgress({
        run_id: created.run_id,
        status: "running",
        stage: "baseline_testing",
        completed_stages: [],
        current_strategy: null,
      });
      return created.run_id;
    },
    [client],
  );

  const configure = useCallback(
    async (strategies: StrategyId[]) => {
      if (!runId) return false;
      setError(null);
      setTerminalMessage(null);
      setBusy(true);
      try {
        await client.configureStrategies(runId, strategies);
        return true;
      } catch (caught) {
        setError(errorMessage(caught));
        setBusy(false);
        return false;
      }
    },
    [client, runId],
  );

  const cancel = useCallback(async () => {
    if (!runId) return;
    try {
      await client.cancelRun(runId);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }, [client, runId]);

  const reset = useCallback(() => {
    generation.current += 1;
    setRequested(false);
    setRunId(null);
    setProgress(null);
    setReport(null);
    setError(null);
    setTerminalMessage(null);
    setBusy(false);
  }, []);

  return {
    requested,
    runId,
    progress,
    report,
    error,
    terminalMessage,
    busy,
    start,
    configure,
    cancel,
    reset,
  };
}