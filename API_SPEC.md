# API Contract Specification

All endpoints use `/api/v1`, JSON, Pydantic validation, opaque IDs, and one error shape:

```json
{"error":{"code":"upload_rejected","message":"Safe user-facing text","request_id":"req_..."}}
```

## Endpoints

| Method/path | Request | Response | Notes |
|---|---|---|---|
| `GET /tasks` | query: active corpus version | public `TaskCatalog` | Never includes hidden facts/tests |
| `POST /uploads` | bounded multipart source/archive | `UploadReceipt` | Exploratory intake only; validate before extraction/execution |
| `POST /runs` | `RunCreate` | `Run` | Freezes mode, input, scan categories, strategy selection, config IDs |
| `POST /runs/{id}/start` | none | `Run` | State changes queued → running asynchronously |
| `POST /runs/{id}/cancel` | none | `Run` | Cooperative cancellation; reports cleanup state |
| `GET /runs/{id}` | none | `Run` | Bounded status/progress only |
| `GET /runs/{id}/report` | none | `RunReport` | Redacted public evidence/results |
| `GET /aggregates/official` | matching corpus/config filters | `OfficialAggregate` | Backend applies official-eligibility predicate |

## Essential models

`RunCreate`: `mode` (`benchmark|custom_prompt|upload`), `task_id` for benchmark, `upload_id` for upload, bounded `custom_prompt`, `scan_categories` (unique set of 1–5 known IDs), `strategies` (one-or-more fixed IDs or `run_all`), and requested display options. The server, not client, sets `official_eligible`.

`Run`: `run_id`, `mode`, `official_eligible`, `status`, `attempt_summaries`, `manifest_hash`, timestamps, structured failure/cancellation state.

`RunReport`: public task/input descriptor; selected and skipped scan categories; baseline/candidate summaries; validated reviewer and interpretation results; deterministic metrics/rankings; configuration/coverage/limitations; persistent exploratory label. It excludes raw credentials, evaluator truth, restricted artifacts, filesystem paths, and arbitrary unbounded logs.

`OfficialAggregate`: corpus/config/metric version, qualifying run/attempt counts, deterministic metrics, comparisons, and exclusion statement. Its query implementation must include the eligibility predicate in storage access.

## Client update model

Poll `GET /runs/{id}` with bounded backoff initially; an event stream may be added later without changing schemas. The client must render `queued`, `running`, `completed`, `failed`, and `cancelled`; it must not infer completion from elapsed time or model output.
