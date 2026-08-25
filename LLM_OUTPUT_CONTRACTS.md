# LLM Output Contracts and Token Policy

## Common envelope

Every model role returns JSON only, no Markdown fences, validated with Pydantic:

```json
{"schema_version":"1.0","status":"accepted","items":[],"limitations":[]}
```

All schemas reject unknown top-level fields, cap field lengths/list sizes, use enumerations for state, and include an opaque correlation ID. Persist raw output in restricted artifacts; return validated, redacted data to the client.

## Repair output

```json
{
  "schema_version":"1.0",
  "status":"accepted",
  "patch_format":"unified_diff",
  "patch":"...",
  "changed_files":["src/example.py"],
  "rationale":"<= 280 characters",
  "limitations":["<= 180 characters"]
}
```

Accepted statuses: `accepted`, `cannot_repair`. Apply diffs only in the sandbox after path/size/patch validation. A schema-invalid or unsafe patch is recorded as `schema_invalid`/`patch_rejected`; allow at most one compact corrective retry with the validation error, then stop.

## Reviewer output

```json
{
  "schema_version":"1.0",
  "verdict":"accept|concern|reject|insufficient_evidence",
  "confidence":"low|medium|high",
  "observations":[{"evidence_ref":"public:scan:1","text":"<= 240 chars"}],
  "limitations":["<= 180 chars"]
}
```

The reviewer prompt says it is advisory, blind to strategy and ground truth, and must cite only supplied evidence references.

## Interpretation output

Input is a minimal validated facts object: mode label, strategy display labels, deterministic test/scan deltas, metrics, ranking result, and limitations. It excludes raw code, secrets, hidden ground truth, and irrelevant logs.

```json
{
  "schema_version":"1.0",
  "headline":"<= 140 characters",
  "summary":"<= 700 characters",
  "comparisons":[{"strategy_id":"...","text":"<= 350 characters"}],
  "caveats":["<= 180 characters"]
}
```

If validation fails or the LLM is unavailable, render a deterministic template generated from the facts and label it accordingly. Never retry unboundedly.

## Token-efficient prompting

- Use immutable prompt templates with a hash/version.
- Send only selected files/line ranges, normalized findings, failed-test excerpts, and task IDs; never whole repositories by default.
- Deduplicate repeated evidence; reference content hashes/opaque IDs in internal records.
- Set role-specific output caps; compact JSON keys are acceptable internally but preserve clear validated public fields.
- Measure input/output tokens separately per stage, including retry count. Cache only safe immutable preprocessing, never user secrets or model responses that could cross isolation boundaries.
