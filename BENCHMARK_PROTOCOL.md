# Benchmark Protocol and Metrics

## Corpus protocol

The official corpus is exactly 24 predefined, versioned, mixed-risk tasks. Each task receives a stable ID and public source/public tests. Evaluator-only assets hold ground-truth issue records, expected remediation criteria, and hidden tests. Hash public and protected bundles separately in the corpus manifest.

## Official-run eligibility

`official_eligible=true` only when all conditions hold: mode is Benchmark; task belongs to the 24-task active corpus; all pinned tool/rule/container/model/prompt/metric versions match; immutable baseline and evidence manifest exist; and no run invalidation reason is present. Aggregation APIs enforce this predicate—not merely UI filtering.

## Measurements (deterministic)

- `security_effectiveness`: weighted reduction of evaluator-matched ground-truth vulnerabilities, with newly introduced evaluator-detected vulnerabilities counted negatively. The precise category weights live in the versioned metric policy.
- `functionality_preservation`: public and hidden functional-test outcomes calculated from recorded commands/exit results.
- `token_count`, `cost_usd`, `latency_ms`: summed per-stage gateway records; use provider usage plus pinned pricing snapshot.
- `best_overall`: rank eligible completed attempts by security effectiveness descending, functionality preservation descending, then lower introduced findings, lower cost, lower latency, stable attempt ID.
- `best_efficiency`: rank eligible attempts by the versioned efficiency formula, `security_effectiveness × functionality_preservation / max(cost_usd, cost_floor)`, then lower tokens, lower latency, stable attempt ID. Display the formula/version and do not call it “best overall.”

No LLM determines eligibility, finding counts, scores, rankings, ties, or aggregates.

## Reviewer blinding

The reviewer receives an opaque attempt label, candidate diff, public/normalized test-scan evidence, and evaluation rubric. It must not receive strategy ID/name, ground truth, previous score, winner status, or other attempts’ outcomes. Its structured verdict is advisory only.

## Reporting exclusions

Custom Prompt and Upload Existing Code results are excluded from official summary cards, datasets, exports, chart queries, and winner selection. Render a persistent `Exploratory — not included in benchmark statistics` label for those modes.
