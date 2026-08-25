# Figma Make Input Checklist

Attach the complete Figma Make project export alongside `MASTER_CODEX_PROMPT.md`. The previous export contained these **10 project files**; include the actual files, not screenshots alone:

- [ ] `src/App.tsx` — existing screens, simulated data/workflow, components, interactions, and animation source.
- [ ] `src/index.css` — global styles, fonts, Tailwind directives, and custom animation styles.
- [ ] `src/main.tsx` — frontend bootstrap.
- [ ] `index.html` — Vite HTML shell.
- [ ] `package.json` — frontend dependencies and scripts.
- [ ] `vite.config.ts` — Vite/Tailwind/Figma configuration.
- [ ] `tsconfig.json` — TypeScript configuration and `@/*` alias.
- [ ] `pnpm-lock.yaml` — exact package lock.
- [ ] `.gitignore` — especially its `.env*` protection.
- [ ] `.gitattributes` — LFS patterns for assets/datasets.

Also include these if they exist in the downloaded Figma project (they were described in the prior conversation but are not counted in the 10-file export list):

- [ ] `AGENTS.md`
- [ ] `CLAUDE.md`
- [ ] `.mise.toml`
- [ ] Any `public/`, `src/assets/`, image/font/icon, or generated-component directories referenced by `App.tsx`/CSS.

Do **not** attach a real LLM key, production `.env`, hidden benchmark ground truth, user-uploaded code, or credentials. Provide secrets locally through ignored environment configuration when implementation begins.
