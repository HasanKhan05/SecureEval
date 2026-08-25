import type {
  ErrorEnvelope,
  HealthResponse,
  Run,
  RunCreate,
  UploadPurpose,
  UploadReceipt,
} from "../contracts/api-v1";

export interface SecureEvalClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof globalThis.fetch;
}

export class SecureEvalApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;

  constructor(status: number, envelope: ErrorEnvelope) {
    super(envelope.error.message);
    this.name = "SecureEvalApiError";
    this.status = status;
    this.code = envelope.error.code;
    this.requestId = envelope.error.request_id;
  }
}

export interface SecureEvalClient {
  health(): Promise<HealthResponse>;
  uploadSource(source: File, purpose: UploadPurpose): Promise<UploadReceipt>;
  createRun(payload: RunCreate): Promise<Run>;
  getRun(runId: string): Promise<Run>;
  startRun(runId: string): Promise<Run>;
  cancelRun(runId: string): Promise<Run>;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as Record<string, unknown>).code === "string" &&
    typeof (error as Record<string, unknown>).message === "string" &&
    typeof (error as Record<string, unknown>).request_id === "string"
  );
}

export function createSecureEvalClient(
  options: SecureEvalClientOptions = {},
): SecureEvalClient {
  const baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(`${baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body && !(init.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...init?.headers,
      },
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error("SecureEval API returned an invalid JSON response.");
    }

    if (!response.ok) {
      if (isErrorEnvelope(body)) {
        throw new SecureEvalApiError(response.status, body);
      }
      throw new Error("SecureEval API returned an invalid error response.");
    }
    return body as T;
  }

  const runPath = (runId: string) => `/runs/${encodeURIComponent(runId)}`;

  return {
    health: () => request<HealthResponse>("/health"),
    uploadSource: (source, purpose) => {
      const body = new FormData();
      body.append("purpose", purpose);
      body.append("source", source);
      return request<UploadReceipt>("/uploads", { method: "POST", body });
    },
    createRun: (payload) =>
      request<Run>("/runs", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    getRun: (runId) => request<Run>(runPath(runId)),
    startRun: (runId) => request<Run>(`${runPath(runId)}/start`, { method: "POST" }),
    cancelRun: (runId) => request<Run>(`${runPath(runId)}/cancel`, { method: "POST" }),
  };
}
