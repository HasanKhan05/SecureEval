# Reproducibility and Experiment Control

## Immutable run manifest

Create a canonical JSON manifest before execution and hash it. It contains: run/mode/task IDs; corpus/public and protected evaluator hashes; source revision; scan-policy/rule versions; package lock hashes; Docker image digest; test/scanner commands; strategy IDs/prompt template hashes; reviewer/interpreter template hashes; provider/model snapshot, temperature, seed if supported, max output tokens, context limit, retry policy; pricing snapshot; metric-policy version; platform/runtime versions; timestamps.

The original manifest is immutable. Derived fields such as outcomes and artifact hashes are appended to an evidence record that references it; changes create a new run/config version.

## Official configuration

One versioned official model configuration is active for a release. Do not silently switch model aliases, temperatures, retries, pricing, rules, or container tags. A change means a new experiment version and aggregates are filtered/grouped by it.

## Repeatability

Use stable task ordering, normalized paths, canonical JSON, deterministic finding fingerprints/sorts, defined timestamps/time zones, fixed commands, and explicit tie-breakers. Capture random seeds where tools/providers support them; otherwise record that the run is nondeterministic and compare repeated trials according to a predeclared protocol.

## Evidence retention

Keep hashes and redacted bounded logs sufficient to verify claims. Protect restricted artifacts (raw uploads, model requests/responses, evaluator truth) separately. A report displays configuration ID, manifest hash, corpus version, metric version, and any unavailable/timeout stages.

## Replay

A replay command accepts the run manifest/config and uses the pinned container/rules/corpus. It must refuse official replay if a required immutable input is unavailable or hash-mismatched, rather than producing a lookalike result.
