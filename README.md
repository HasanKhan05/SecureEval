# SecureEval

SecureEval is an interactive local portfolio demo for comparing security-oriented code-repair strategies. It preserves the supplied Figma design and uses deterministic sample data—no API keys, external services, or code execution are required.

## Run locally

Requirements: Node.js 20+ and Corepack.

```powershell
cd frontend
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open the local URL printed by Vite. The demo supports Benchmark, Custom Prompt, and Upload Code modes, including validation, progress, cancellation, retry, comparison results, and refresh persistence.

## Important

Results, scanner findings, token/cost/latency values, and reviewer explanations are deterministic demo fixtures. They demonstrate the product workflow and do not represent real security testing or a security guarantee. Uploaded code remains in the browser and is not executed or sent to an external service.

To verify a production build:

```powershell
cd frontend
corepack pnpm exec tsc --noEmit
corepack pnpm build
```