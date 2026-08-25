# SecureEval Project Runbook — What You Do at Every Stage

Use this document as your checklist. It assumes Codex is building the project and Antigravity is used only for high-risk independent review.

## 1. Prepare the two uploads

Create one folder or ZIP containing the **complete, unmodified Figma Make project export**: all source, configuration, lockfile, and referenced UI asset files. Do not include real API keys, `.env` files, user code uploads, or hidden benchmark ground truth.

Keep this second file ready:

- `SecureEval-Codex-Planning-Package.zip`

The planning ZIP contains the master implementation prompt, project rules, phase tracker, risk register, and Antigravity materials.

## 2. Start the Codex project

In a new Codex project/chat, upload:

1. The complete Figma Make export ZIP/folder.
2. `SecureEval-Codex-Planning-Package.zip`.

Then paste this message:

```text
Use the uploaded Figma Make project as the frontend baseline and the uploaded SecureEval planning package as the governing project documentation.

First read MASTER_CODEX_PROMPT.md, AGENTS.md, IMPLEMENTATION_PLAN.md, PRODUCT_SPEC.md, ARCHITECTURE.md, API_SPEC.md, BENCHMARK_PROTOCOL.md, SECURITY_DESIGN.md, TESTING_AND_QA.md, LLM_OUTPUT_CONTRACTS.md, REPRODUCIBILITY.md, RISK.md, and PHASE_STATUS.md.

Start Phase 0 only. Preserve the Figma UI. Follow the hybrid review process: self-test and self-review every phase; stop for my external Antigravity review before commit/push only at Phases 2, 4, 5, 6, 7, and 9. Do not begin a later phase until the current phase is closed in PHASE_STATUS.md.
```

## 3. What Codex does after every phase

For every phase, Codex must:

1. Implement only that phase’s scope.
2. Run its relevant tests, build/type checks, and focused self-review.
3. Update `RISK.md` and `PHASE_STATUS.md` with actual evidence, remaining work, commit SHA, and push state.
4. Commit/push routine phases only if its checks pass.
5. For high-risk phases, stop before commit/push and prepare the Antigravity handoff package.

If Codex forgets, paste:

```text
Stop at the end of the current phase. Run the required checks and self-review. Update RISK.md and PHASE_STATUS.md with real evidence. If this is a high-risk phase, do not commit or push: generate the completed ANTIGRAVITY_PHASE_HANDOFF_TEMPLATE.md package for me.
```

## 4. Routine phases — no Antigravity needed

| Phase | You do | Message to Codex after it reports work |
|---|---|---|
| 0 — Figma baseline/docs | Check that it preserved UI and documented inventory | `Review your Phase 0 evidence, update RISK.md and PHASE_STATUS.md, then commit/push only if checks pass. Proceed to Phase 1.` |
| 1 — Backend foundation | Check summary/API evidence | `Review your Phase 1 evidence, update RISK.md and PHASE_STATUS.md, then commit/push only if checks pass. Proceed to Phase 2 and stop for external review at its end.` |
| 3 — Scan pipeline | Check it states categories/tools/tests clearly | `Review your Phase 3 evidence, update RISK.md and PHASE_STATUS.md, then commit/push only if checks pass. Proceed to Phase 4 and stop for external review at its end.` |
| 8 — Reproducibility/efficiency | Check replay/export evidence | `Review your Phase 8 evidence, update RISK.md and PHASE_STATUS.md, then commit/push only if checks pass. Proceed to Phase 9 and stop for external review at its end.` |

Do not treat a routine-phase claim as proof if Codex has no test/build evidence. Ask for the command/results before allowing it to move on.

## 5. Set up Antigravity once

Open an Antigravity project/chat. Upload these once:

1. `SecureEval-Codex-Planning-Package.zip`.
2. The Figma export if Antigravity needs to inspect UI preservation; otherwise provide it at Phase 7 and 9.

Paste the full contents of `ANTIGRAVITY_REVIEWER_PROMPT.md`, then say:

```text
You are my independent reviewer for SecureEval. Retain the uploaded planning package as the acceptance criteria. Review only high-risk phases 2, 4, 5, 6, 7, and 9 unless I explicitly request another phase. Return the exact PASS / PASS WITH FOLLOW-UPS / BLOCK format required by the reviewer prompt.
```

## 6. High-risk review workflow

The high-risk phases are **2, 4, 5, 6, 7, and 9**. At the end of each one, ask Codex:

```text
Phase <N> is a high-risk external review gate. Do not commit or push. Create the completed ANTIGRAVITY_PHASE_HANDOFF_TEMPLATE.md package now. Include changed files/diff, exact commands and results, known failures, relevant screenshots/manifests/logs, proposed RISK.md/PHASE_STATUS.md changes, and the specific acceptance criteria. Wait for my Antigravity verdict.
```

Codex should give you:

- A completed handoff document.
- Changed files, a commit/diff, or both.
- Exact build/test command results.
- Screenshots or UI reproduction instructions when the phase changes UI.
- Relevant artifact: sandbox evidence, scan logs/rule versions, benchmark manifest, LLM validation evidence, or replay output.

Upload/paste that package into Antigravity and send:

```text
Review SecureEval Phase <N> using your standing reviewer prompt and the attached Codex handoff. Independently inspect the evidence and run feasible checks. Return the required review format with a clear PASS, PASS WITH FOLLOW-UPS, or BLOCK verdict.
```

### What Antigravity should focus on

| High-risk phase | Required external focus |
|---|---|
| 2 — Sandbox/uploads | Docker isolation; no host/network/secret exposure; hostile archive/upload rejection; cleanup/limits |
| 4 — Benchmark boundary | Exactly 24 tasks; hidden ground truth/evaluator isolation; official-only aggregate predicate |
| 5 — Repair/scoring | Same immutable baseline; isolated Run All; retest/rescan; deterministic metrics, ties, best overall/efficiency |
| 6 — LLM gateway | Strict JSON/Pydantic validation; bounded retries/fallback; reviewer blinding; prompt/cost/latency safety |
| 7 — UI integration | Figma preservation; real job/error states; exploratory exclusions; factual LLM interpretation/fallback |
| 9 — Release | Clean setup; full tests; security/replay/UI audit; remaining risks and release decision |

## 7. Give Antigravity’s verdict back to Codex

Copy Antigravity’s entire review response into Codex. Then use the message matching its verdict.

### If Antigravity says PASS

```text
Here is the external Antigravity review for Phase <N>:

<PASTE THE FULL REVIEW>

The verdict is PASS. Update RISK.md and PHASE_STATUS.md with the reviewer/evidence and actual test results. Commit and push Phase <N> if all documented checks still pass. Then continue to Phase <N+1> only.
```

### If Antigravity says PASS WITH FOLLOW-UPS

```text
Here is the external Antigravity review for Phase <N>:

<PASTE THE FULL REVIEW>

Do not treat this as approval to push until you list each follow-up and tell me whether it violates a required acceptance criterion. Fix all required items, re-run relevant checks, update the handoff evidence, and request a final PASS from Antigravity if a required item was found.
```

### If Antigravity says BLOCK

```text
Here is the external Antigravity review for Phase <N>:

<PASTE THE FULL REVIEW>

The verdict is BLOCK. Do not commit/push or start the next phase. Address only the listed blockers, re-run the relevant checks, update RISK.md and PHASE_STATUS.md, and produce a new completed Antigravity handoff package for re-review.
```

## 8. Progress order

Follow exactly this sequence:

1. Phase 0 — Codex self-review/commit.
2. Phase 1 — Codex self-review/commit.
3. Phase 2 — Antigravity review required before commit.
4. Phase 3 — Codex self-review/commit.
5. Phase 4 — Antigravity review required before commit.
6. Phase 5 — Antigravity review required before commit.
7. Phase 6 — Antigravity review required before commit.
8. Phase 7 — Antigravity review required before commit.
9. Phase 8 — Codex self-review/commit.
10. Phase 9 — Antigravity final release review required before commit/push/release.

## 9. Final release handoff

At Phase 9, give Antigravity the full final project or repository, final diff/commit history, complete automated-test output, clean-install/setup evidence, Figma UI screenshots or walkthrough, benchmark replay evidence, manifests, and current `RISK.md`/`PHASE_STATUS.md`.

Use this message:

```text
This is SecureEval Phase 9, the final release gate. Review the full project against the planning package. Verify clean setup, automated tests, sandbox security, benchmark isolation, deterministic metrics, LLM contracts, reproducibility/replay, official-versus-exploratory separation, and Figma UI preservation. Return the required review format. A PASS is required before release.
```

Only after final `PASS`, tell Codex:

```text
The Phase 9 external final review is PASS. Update RISK.md and PHASE_STATUS.md with final evidence and limitations. Commit and push only if all final checks still pass. Give me the final run instructions, environment-variable list without secret values, and exact commands to start the application and replay an official experiment.
```

## One rule to remember

Never give real provider API keys, a production `.env`, hidden benchmark answer keys, or real user-uploaded code to Antigravity unless you deliberately accept the security/privacy implications. Use redacted logs and the protected benchmark interface evidence instead.
