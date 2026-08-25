# Security Design

## Threat model

Attackers may submit malicious archives/code/tests, induce risky generated patches, exploit scanner/log parsing, prompt-inject through code/comments, steal model credentials, access hidden benchmark truth, exhaust compute, or cause an exploratory result to be misrepresented as official.

## Execution sandbox policy

Run tests, scans, and generated code only in an ephemeral Docker container with network disabled, non-root UID, dropped Linux capabilities, `no-new-privileges`, read-only root filesystem, isolated writable temp workspace, no host mounts, no Docker socket, resource/PID/time/output limits, and a pinned image digest. Destroy the workspace/container after collection. Enforce an allowed language/runtime list; do not execute arbitrary binaries or nested containers.

## Upload boundary

Allowlist source types and configured size/file/count limits. Inspect archives before extraction; reject absolute paths, `..` traversal, symlinks/hardlinks, special files, nested archives beyond policy, excessive expansion ratios, encrypted/invalid archives, unsupported encodings, and binaries. Generate opaque artifact IDs and separate retention policies for user uploads and official fixtures.

## Hidden benchmark boundary

The repair runner, repair LLM, reviewer LLM, client, and public API never receive answer keys, hidden tests, expected findings, scoring weights, or evaluator artifact paths. The evaluator receives candidate output only through a narrow interface and emits minimal normalized score facts. Enforce this by separate filesystem/package/service access, not conventions.

## Secrets/logging

Load provider keys server-side from ignored runtime environment/secret manager. Redact credentials, tokens, private paths, and recognizable secret values before persistence/display. Scope access by role; return bounded log excerpts. Audit run creation, evaluator access, model invocation metadata, artifact accesses, cancellation, and deletion.

## Supply chain and API

Pin Python/Node dependencies and container digests; scan dependencies; review lockfile changes. Validate every request with Pydantic, authenticate and authorize state-changing/artifact endpoints, impose rate/size/concurrency limits, and use non-guessable run/artifact IDs. Never expose tracebacks in client responses.

## Security claim discipline

Passing Bandit/Semgrep/tests is evidence for the configured scope only. Reports must present coverage, unavailable tools, timeouts, and reviewer limitations; never certify arbitrary code as secure.
