# External Reviewer Handoff Roles

Codex implements, self-tests, and self-reviews all phases. The user supplies the independent reviewer through a separate AI agent only for high-risk gates: Phases 2, 4, 5, 6, 7, and 9.

| Role | Primary work | Must independently verify |
|---|---|---|
| Codex implementer/orchestrator | Scope, sequencing, implementation, self-testing, self-review, documentation and evidence handoff | Prepares all phase evidence and external-gate evidence where required |
| Backend/API implementer | FastAPI contracts, persistence, job lifecycle | Contract validation and error semantics before handoff |
| Sandbox/security reviewer | Docker policy, upload intake, secret/log boundaries | Escape paths, limits, retention, hostile archive/test cases |
| Scanner/benchmark reviewer | Rulesets, finding normalization, evaluator boundary, metric logic | Determinism, hidden-ground-truth isolation, official predicates |
| Functional/API QA | Unit/integration tests and failure behavior | Real API/job state flows; no implementation ownership |
| Figma regression reviewer | Figma visual/interaction preservation | Screens, navigation, responsive states, loading/error bindings |
| LLM contract reviewer | Prompt minimization, JSON schemas, validation/fallback | No deterministic decision delegated; bounded retries/cost records |
| Final release reviewer | End-to-end audit | Clean setup, benchmark replay, required evidence and open blockers |

## Review assignment by phase

- Phases 0, 1, 3, and 8: Codex self-tests and self-reviews; no Antigravity handoff required unless the user requests it.
- Phase 2: external sandbox/security review required.
- Phase 4: external benchmark/reproducibility review required.
- Phase 5: external strategy-isolation/metrics review required.
- Phase 6: external LLM contract/security review required.
- Phase 7: external Figma/LLM integration review required.
- Phase 9: external final release review required.

## Report template for the external AI reviewer

```markdown
Scope reviewed:
Files/evidence reviewed:
Checks independently run and results:
Findings: [severity, evidence, impact]
Unverified areas:
Decision: PASS | BLOCK
```
