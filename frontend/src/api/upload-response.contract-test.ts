import { createSecureEvalClient } from "./client";
import type { UploadReceipt } from "../contracts/api-v1";

const backendReceiptFixture = {
  schema_version: "1.0",
  upload_id: "upload_00000000000000000000000000000000",
  purpose: "uploaded_code",
  file_count: 1,
  total_bytes: 10,
  content_hash: "sha256:fixture",
  retention_class: "exploratory_24h",
  created_at: "2026-08-25T00:00:00Z",
  expires_at: "2026-08-26T00:00:00Z",
} as const satisfies UploadReceipt;

const client = createSecureEvalClient();
const receipt: Promise<UploadReceipt> = client.uploadSource(
  new File(["value = 1\n"], "source.py", { type: "text/x-python" }),
  "uploaded_code",
);

void [backendReceiptFixture, receipt];
