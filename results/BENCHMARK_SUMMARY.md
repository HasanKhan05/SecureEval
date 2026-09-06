# SecureEval Official Benchmark Experimental Summary

- **Execution Model**: `gemini/gemini-3.1-flash-lite`
- **Gateway**: OmniRoute (OpenAI-compatible `/v1` endpoint)
- **Matrix Size**: 5 Benchmark Tasks × 3 Strategies = 15 Attempts
- **Total Duration**: 423.1s (~7.05 min)
- **Total Tokens**: 40,979
- **Total Cost USD**: $0.0000
- **Invalid / Local Fallback Attempts**: 0

---

## 1. Aggregate Results by Strategy

| Strategy ID | Valid Attempts | Avg Security | Avg Functionality | Avg Overall | Avg Efficiency | Repaired Findings Remaining | Introduced Findings | Total Tokens | Avg Latency (ms) | Tasks Reaching 0 SAST Findings | Tasks Preserving All Tests |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `vulnerability_specific_v1` | 5/5 | 100.00 | 100.00 | 100.00 | 100.00 | 0 | 0 | 13,290 | 15428 | 5/5 | 5/5 |
| `scanner_feedback_v1` | 5/5 | 80.00 | 60.00 | 74.00 | 40.00 | 1 | 0 | 14,572 | 18410 | 4/5 | 3/5 |
| `test_feedback_v1` | 5/5 | 80.00 | 80.00 | 80.00 | 60.00 | 1 | 0 | 13,117 | 15190 | 4/5 | 4/5 |

---

## 2. Aggregate Results by Task

| Task ID | Task Title | Baseline Findings | Baseline Tests | Avg Security | Avg Functionality | Avg Overall | Clean SAST Repairs | Full Test Preservation | Avg Tokens |
|---|---|---|---|---|---|---|---|---|---|
| `T-01` | User Login Service | 2 | 2 | 100.00 | 66.67 | 90.00 | 3/3 | 2/3 | 2548 |
| `T-02` | Document File Reader | 1 | 2 | 100.00 | 66.67 | 90.00 | 3/3 | 2/3 | 2720 |
| `T-03` | Command Argument Builder | 1 | 2 | 100.00 | 66.67 | 90.00 | 3/3 | 2/3 | 2010 |
| `T-04` | API Token Configuration | 1 | 2 | 33.33 | 100.00 | 53.33 | 1/3 | 3/3 | 3535 |
| `T-05` | Password Digest Utility | 1 | 2 | 100.00 | 100.00 | 100.00 | 3/3 | 3/3 | 2847 |

---

## 3. Full Raw Attempt Matrix

| Task | Strategy | Run ID | Source | Model | Baseline Findings (B/S) | Repaired Findings (B/S) | Baseline Tests (P/F) | Repaired Tests (P/F) | Security | Functionality | Overall | Efficiency | Tokens (In/Out/Total) | Latency | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `T-01` | `vulnerability_specific_v1` | `run_68332822...` | llm | `gemini/gemini-3.1-flash-lite` | 2 (1/1) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 395/2360/2755 | 21689ms | completed |
| `T-01` | `scanner_feedback_v1` | `run_c62b2b3b...` | llm | `gemini/gemini-3.1-flash-lite` | 2 (1/1) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 395/2099/2494 | 17217ms | completed |
| `T-01` | `test_feedback_v1` | `run_9cbed065...` | llm | `gemini/gemini-3.1-flash-lite` | 2 (1/1) | 0 (0/0) | 2/0 | 0/0 | 100.0 | 0.0 | 70.0 | 0.0 | 395/2000/2395 | 13788ms | completed |
| `T-02` | `vulnerability_specific_v1` | `run_36a59322...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (0/1) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 251/2392/2643 | 14234ms | completed |
| `T-02` | `scanner_feedback_v1` | `run_775e3dfc...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (0/1) | 0 (0/0) | 2/0 | 0/0 | 100.0 | 0.0 | 70.0 | 0.0 | 251/2252/2503 | 14328ms | completed |
| `T-02` | `test_feedback_v1` | `run_b7d8f6bd...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (0/1) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 251/2763/3014 | 16278ms | completed |
| `T-03` | `vulnerability_specific_v1` | `run_84aef311...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (0/1) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 238/1587/1825 | 12101ms | completed |
| `T-03` | `scanner_feedback_v1` | `run_617a9d39...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (0/1) | 0 (0/0) | 2/0 | 0/0 | 100.0 | 0.0 | 70.0 | 0.0 | 238/2413/2651 | 14672ms | completed |
| `T-03` | `test_feedback_v1` | `run_af20b3cc...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (0/1) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 238/1316/1554 | 10802ms | completed |
| `T-04` | `vulnerability_specific_v1` | `run_3e88fa53...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (1/0) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 269/2766/3035 | 14464ms | completed |
| `T-04` | `scanner_feedback_v1` | `run_7aeb7f8a...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (1/0) | 1 (1/0) | 2/0 | 2/0 | 0.0 | 100.0 | 30.0 | 0.0 | 269/3975/4244 | 17088ms | completed |
| `T-04` | `test_feedback_v1` | `run_12660f8e...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (1/0) | 1 (1/0) | 2/0 | 2/0 | 0.0 | 100.0 | 30.0 | 0.0 | 269/3057/3326 | 18961ms | completed |
| `T-05` | `vulnerability_specific_v1` | `run_da8d68ae...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (1/0) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 296/2736/3032 | 14654ms | completed |
| `T-05` | `scanner_feedback_v1` | `run_47b60046...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (1/0) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 296/2384/2680 | 28743ms | completed |
| `T-05` | `test_feedback_v1` | `run_095a5838...` | llm | `gemini/gemini-3.1-flash-lite` | 1 (1/0) | 0 (0/0) | 2/0 | 2/0 | 100.0 | 100.0 | 100.0 | 100.0 | 296/2532/2828 | 16123ms | completed |

---

## 4. SecureEval Research Boundaries & Notes

1. **Static Analysis Guarantee**: 0 Bandit/Semgrep findings does **not** prove mathematical absence of vulnerabilities.
2. **Warning vs Exploitability**: Scanner warnings indicate policy/heuristic pattern matches, not proven exploitability in context.
3. **Task Scope**: Results are measured on controlled benchmark fixtures (T-01 to T-05) and reflect targeted remediation within those environments.
4. **Official Bounds**: Only Benchmark Mode contributes to official scoring and aggregates; exploratory flows are isolated.
