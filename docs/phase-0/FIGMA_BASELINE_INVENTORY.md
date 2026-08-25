# Figma Make baseline inventory

Date: 2026-08-25
Source archive: `FigmaMakeSecureEval.zip`
Source archive SHA-256: `d7bdd3eab90fa432d6081ee10925d947afbb75c8304c11d01aa82440fa7af4b1`
Planning archive SHA-256: `7d94289855ff1beefef7d8ed0e06e183b25f9afbaae8450e687d641d1290bfc5`
Imported frontend root: `frontend/`
Baseline source revision: `d873c51b99b757b7421a138bfd626366238eef4f`

## Preservation statement

The complete Figma Make export is retained under `frontend/`. Phase 0 does not
change `src/App.tsx`, `src/index.css`, `src/main.tsx`, `index.html`, or
`vite.config.ts`. No visual component, screen, navigation transition, class,
copy block, responsive rule, or animation was redesigned.

Core baseline hashes:

| File | Bytes | SHA-256 |
|---|---:|---|
| `src/App.tsx` | 117678 | `441d7f2a62f3cbd4faf13d67c79b71461bb38122a9f3c549c035595e7b665bbe` |
| `src/index.css` | 3146 | `9d81e38beaf10b71e1d936ee291728751cbe2382be540112bdc2d744322b00dc` |
| `src/main.tsx` | 232 | `5f49dce6e6cc4b5d678cf529ef892af0ab7dfa6afb300b11ad559224019b8b05` |
| `vite.config.ts` | 11726 | `e326dff7ba3e98aca4e374355e12fa6e34534a3c6759a848aacdc606be2b027c` |
| `package.json` | 600 | `c2d99ed2073126d401a3a9b1a2b1691e998058e9fe14da7105857f8a853e38d5` |
| `pnpm-lock.yaml` | 29455 | `811aecd91f12d4f77c1b88c0ea1edd5127b6bf2150e668e62659cadaac366460` |

## Phase 2 hardened render baseline

Production renders were captured with Microsoft Edge `151.0.4129.107` in
headless mode at the fixed landing-screen viewport `1440x1080`. For each
capture, the relevant production `dist/` directory was copied to a temporary,
non-repository local server root. A capture-only `<style>` was injected into
that temporary `index.html` to set `animation` and `transition` to `none`; no
application source or shipped CSS was changed. The pre-change root was built
from `3714216a6b029bf471949aeabfd95b609ced8c02`; the post-change root was
built from this worktree.

Each root was served locally on `127.0.0.1`, then Edge used `--headless=new`,
`--no-first-run`, `--disable-extensions`, `--disable-gpu`, `--hide-scrollbars`,
an isolated `--user-data-dir`, `--virtual-time-budget=2000`, and
`--window-size=1440,1080`. A capture was accepted only after four consecutive
500 ms SHA-256 reads matched, and a second isolated capture produced the same
hash. This freezes evidence timing without removing application animations.

| Capture | File | SHA-256 |
|---|---|---|
| Before canonical taxonomy and local-font changes | `docs/phase-2/figma-hardened-before.png` | `d7e81ea6e068890ac956ff8fa7ab8ae943c09eb3931fe0055fc32ad689bca259` |
| After canonical taxonomy and local-font changes | `docs/phase-2/figma-hardened-after.png` | `d7e81ea6e068890ac956ff8fa7ab8ae943c09eb3931fe0055fc32ad689bca259` |
## Complete export file list

| Group | Files |
|---|---|
| Project | `.gitattributes`, `.gitignore`, `.mise.toml`, `AGENTS.md`, `CLAUDE.md`, `index.html`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `vite.config.ts` |
| Figma tooling | `.figma/make/analyze-routes`, `.figma/make/deploy`, `.figma/make/deploy-preview`, `.figma/make/dev`, `.figma/make/dev.json`, `.figma/make/format`, `.figma/make/install`, `.figma/make/langserver`, `.figma/make/site.json` |
| Runtime source | `src/App.tsx`, `src/index.css`, `src/main.tsx`, `src/vite-env.d.ts` |
| Pasted design context | `src/imports/pasted_text/ai-security-platform-update-1.md`, `ai-security-platform-update-2.md`, `ai-security-platform-update.md`, `ai-security-prompt-update.md`, `ai-security-research-platform.md`, `ai-security-update.md`, `upload-code-mode.md` |

There are 30 files total. The three `ai-security-platform-update*.md` files are
byte-identical. None of the pasted-text Markdown files is imported by runtime
source.

## Visual and interaction baseline

The app is a single React component tree with eight screen states:

0. Landing and pipeline overview.
1. Mode/task/prompt/upload selection.
2. Generated or uploaded code preview.
3. Five-category scan selection.
4. Animated analysis and finding details.
5. One-or-all repair-strategy selection.
6. Parallel repair progress and per-strategy comparison.
7. Winner, efficiency, comparison, interpretation, and limitations.

Navigation is held only in React state (`screen` 0–7); there is no router or
deep-link persistence. The palette, typography hierarchy, responsive layouts,
Unicode icon system, animated background, scan beam, staged progress, diff
view, and card/table structure are the visual baseline to preserve.

## Asset inventory and missing assets

- No PNG, JPEG, SVG, WebP, video, audio, or local font files are present or
  referenced by runtime source.
- UI icons and marks are Unicode glyphs embedded in JSX; no icon package is
  installed.
- `src/index.css` references three external Google Fonts stylesheets: Inter,
  Roboto Condensed, and JetBrains Mono. Offline or blocked-network rendering
  falls back to generic `sans-serif`/`monospace`; local font files are missing.
- `.figma/make/site.json` does not define a favicon, social image, title, or
  language. Its generic project-management description does not describe
  SecureEval. These are metadata gaps, not visual changes for Phase 0.
- `.gitattributes` declares Git LFS patterns, but the export contains no LFS
  pointer-backed visual assets.
- The Figma export does not include screenshots or golden visual snapshots.
  Phase 0 therefore verifies preservation by unchanged core-source hashes,
  successful production build, smoke rendering, and focused source review.

## Mocked behavior and future API mapping

| Current Figma source/state | Current behavior | Governing real contract / later owner |
|---|---|---|
| `BENCHMARK_TASKS` and domain counts | Hardcoded 24-task catalog, metadata, search, and counts | `GET /api/v1/tasks` → `TaskCatalog`; Phase 4 supplies the official corpus. Search may remain presentation-only over returned public data. |
| Benchmark task selection | Stores the task object in browser state and advances screens | `POST /api/v1/runs` with `mode=benchmark` and `task_id`; server determines eligibility. Phase 1. |
| Custom prompt/examples | Browser-only text, capped at 1,000 characters, then advances | `POST /api/v1/runs` with bounded `custom_prompt`; exploratory eligibility is server-owned. Phase 1. |
| Upload drop/input/paste | `FileReader.readAsText`, `.py` filename check only, optional metadata kept in memory | `POST /api/v1/uploads` → `UploadReceipt`, then `POST /runs`; archive/type/size/path validation belongs to Phase 2. Raw code must not persist in client result state. |
| Generation phase | 400 ms dot interval and 3.4 s completion timer | Create/start run and poll `GET /runs/{id}`; render `queued/running/completed/failed/cancelled`. Phase 1 lifecycle and Phase 6 gateway. |
| `SAMPLE_CODE` and `GENERATION_USAGE` | Static generated code, token count, price, latency, and model label | Redacted artifact reference plus measured `LLMInvocation`/report fields; no client estimates. Phases 5–7. |
| `SCAN_CATEGORIES` | Hardcoded five vulnerability examples and browser-held selection | `RunCreate.scan_categories`, governed by the five category IDs and versioned scan policy. Phase 1 contract; Phase 3 tools/rules. |
| Analysis `useEffect` | Per-category timers simulate queue/scan completion | Real run/assessment status from `GET /runs/{id}` and later report/status evidence. Phases 1 and 3. |
| Analysis `findings`/`catStatus` | Three hardcoded findings filtered by selected category | Normalized finding and selected/skipped category summaries in `RunReport`; Phase 3. |
| Strategy metadata/prompts | Browser defines `generic`, `specific`, `scanner` and exposes prompt text | Server accepts only fixed strategy IDs; versioned prompt templates stay server-side. Phases 1, 5, and 6. |
| Comparison branch timers | Five `setTimeout` stages per strategy simulate repair/test/rescan/review | `Run.attempt_summaries` and asynchronous attempt states. Phase 1 state machine and Phases 5–6 execution. |
| `REPAIRED_CODES`, `RESCAN_DATA`, `REVIEWER_DATA` | Static patches, scan results, tests, and reviewer prose | Artifact references, baseline/candidate assessments, and validated blinded `ReviewerResult` in `RunReport`. Phases 5–7. |
| `STRATEGY_SCORES`, `STRATEGY_USAGE`, `calcEfficiency` | Client calculates winner, efficiency, token/cost comparison, and result narrative | Backend-only deterministic `MetricRecord`, best-overall/best-efficiency IDs, measured usage, and validated interpretation/fallback. Phases 5–7. |
| Disabled aggregate/ground-truth JSX | Static benchmark aggregate and “ground truth” blocks are present behind `{false && ...}` | Official aggregate comes only from `GET /aggregates/official`; hidden truth never reaches client code or responses. Phase 4 removes this pattern during real integration. |
| Top navigation | Lets browser state navigate among previously simulated steps without authoritative run guards | Navigation structure stays; enablement/content will follow server lifecycle and safe recovery rules. Phase 7. |

## Contract and UI mismatches to resolve without redesign

1. Figma scan labels are SQL injection, path traversal, command injection,
   insecure deserialization, and hardcoded secrets. The governing five public
   categories are injection, authentication/authorization, secrets, input
   validation, and dependency/configuration risk. Keep the five-card layout,
   but later bind it to the governing category IDs and coverage copy.
2. Figma strategy IDs/labels are `generic`, `specific`, and `scanner`; the
   governing strategies are vulnerability-specific, scanner-feedback, and
   test-feedback. The generic strategy is not a valid official strategy, and
   the UI lacks test-feedback. Preserve the three-card layout while replacing
   semantic labels/IDs with the fixed contracts during integration.
3. The Figma UI displays `GPT-4o`, temperature, token cap, prices, scores, and
   interpretation as facts. The provider/model and every measurement must come
   from the immutable server manifest/evidence. Phase 0 leaves baseline copy
   untouched but records it for replacement.
4. Upload mode currently implies static analysis before any server validation
   and says experiments may enter official statistics with ground truth. The
   governing spec prohibits all upload/custom runs from official aggregation.
5. The disabled ground-truth JSX is not real hidden data, but the public-client
   pattern conflicts with the protected evaluator boundary and must not be used
   by implementation phases.

These are semantic/data-plumbing changes scheduled by the governing phases;
they do not authorize a visual redesign.
