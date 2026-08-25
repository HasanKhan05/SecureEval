# Antigravity Per-Phase Review Handoff Template

After high-risk Phases 2, 4, 5, 6, 7, and 9, Codex should give Antigravity this completed handoff plus the changed project files/diff. Routine phases use Codex self-test/self-review only unless the user requests external review. Do not ask Antigravity to review from a verbal summary alone.

```markdown
# SecureEval — Phase <N> Review Request

## Phase objective
<Copy the exact phase objective and acceptance criteria from IMPLEMENTATION_PLAN.md.>

## Scope implemented
- <concise list of behavior delivered>

## Files changed
- Added: <paths>
- Modified: <paths>
- Deleted: <paths; explain why>

## Figma preservation check
- Existing screens/flows affected: <list>
- Mocked behavior replaced: <list>
- Intentional visual changes: <None or explicit approved reason>
- Screenshots/video or reproduction path: <links/paths>

## API and data-contract changes
- Endpoints/models changed: <exact names>
- Migration/schema changes: <exact names>
- Backward-compatibility or rollout considerations: <none or details>

## Security/research controls affected
- Sandbox/upload boundary: <not applicable or details>
- Hidden benchmark boundary: <not applicable or details>
- Official versus exploratory predicate: <not applicable or details>
- LLM prompts/contracts/cost tracking: <not applicable or details>
- Manifest/version controls: <not applicable or details>

## Verification performed by Codex
| Check | Exact command or procedure | Result | Evidence path/output summary |
|---|---|---|---|
| Unit tests | | | |
| Integration tests | | | |
| Build/type/lint | | | |
| Security/sandbox test | | | |
| UI smoke test | | | |
| Other | | | |

## Known limitations and failures
- <None or list every failure, skipped check, and rationale>

## Required review focus
- <Select the phase-specific checks from ANTIGRAVITY_REVIEWER_PROMPT.md.>

## Proposed RISK.md updates
- <Risk IDs, new evidence, current status; do not mark mitigated without reviewer evidence.>

## Proposed PHASE_STATUS.md entry
- Status: Ready for external review
- Remaining work/blockers: <...>
- Commit/push: Not performed pending external verdict

## Review request
Please use the standing SecureEval reviewer prompt, independently inspect the supplied material, run feasible checks, and return the required verdict format. A `PASS` is required before Codex may commit/push this phase.
```

## What to give Antigravity at each high-risk gate

1. `ANTIGRAVITY_REVIEWER_PROMPT.md` once at the start (or keep it in that task’s context).
2. The entire planning ZIP once, so it has acceptance criteria.
3. The completed handoff template above.
4. The changed files or a reliable diff/commit, plus exact test output and any required screenshots/manifests.
5. For Phase 9, give the whole final project, full test output, environment setup instructions, and benchmark replay evidence.
