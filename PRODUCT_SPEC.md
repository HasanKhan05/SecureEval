# Product Specification

## Purpose

SecureEval measures how well three fixed LLM-assisted repair strategies resolve security issues without breaking behavior. It is an experimental platform, not a production secure-code certification service.

## User-facing modes

### Benchmark Mode — official

The catalog contains exactly 24 predefined mixed-risk tasks. Each task has public task code/instructions and evaluator-only hidden ground truth (expected findings, hidden tests, and scoring references). Users select one strategy or Run All. Official charts, exports, aggregate statistics, and winner claims are generated only from qualifying Benchmark Mode runs.

### Custom Prompt Mode — exploratory

Users supply a repair prompt and optionally bounded code context. It produces an exploratory run report, never a benchmark score or official comparison.

### Upload Existing Code Mode — exploratory

Users upload permitted source code. The platform validates, scans, optionally repairs, and reports it as exploratory. It never enters the 24-task catalog, aggregate charts, exports, or winner claims.

## Five selectable scan categories

1. Injection
2. Authentication and authorization
3. Secrets exposure
4. Input validation
5. Dependency and configuration risk

The scan-policy version maps each category to an explicit Bandit and/or Semgrep rule list. The UI must show selected and unselected categories; a report must never imply an omitted category was checked.

## Strategy definitions

| ID | Name | Repair context |
|---|---|---|
| `vulnerability_specific_v1` | Vulnerability-specific repair | Task/code plus the selected normalized issue facts |
| `scanner_feedback_v1` | Scanner-feedback repair | Task/code plus compact normalized Bandit/Semgrep findings |
| `test_feedback_v1` | Test-feedback repair | Task/code plus failing public functional-test output |

`Run All` invokes those exact IDs in separate isolated workspaces cloned from the same immutable source artifact. No strategy can see another strategy’s patch, output, verdict, or metric.

## Result semantics

- Baseline and candidate runs execute functional tests and selected scans.
- A candidate has a per-strategy report even if a model fails, a sandbox times out, or structured output is invalid.
- The independent reviewer gives an advisory, blinded verdict. It cannot alter deterministic scores.
- Result interpretation is an LLM-generated concise explanation derived only from validated deterministic facts.
- Reports distinguish “scanner found no matching findings” from “security proven.”

## Out of scope for first release

Arbitrary language execution, unbounded repository uploads, autonomous git pushes to user repositories, production vulnerability guarantees, dynamic strategy editing in official experiments, and incorporating exploratory runs into official statistics.
