import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..");
const inventoryPath = resolve(repositoryRoot, "docs", "phase-0", "FIGMA_BASELINE_INVENTORY.md");
const inventory = readFileSync(inventoryPath, "utf8");
const captures = [...inventory.matchAll(
  /\|\s*(?:Before|After)[^|]*\|\s*`(docs\/phase-2\/figma-hardened-(?:before|after)\.png)`\s*\|\s*`([a-f0-9]{64})`\s*\|/g,
)];

if (captures.length !== 2) {
  throw new Error(`Expected two hardened render inventory entries, found ${captures.length}.`);
}

const failures = [];
for (const [, relativePath, expectedHash] of captures) {
  const contents = readFileSync(resolve(repositoryRoot, relativePath));
  const actualHash = createHash("sha256").update(contents).digest("hex");
  const width = contents.readUInt32BE(16);
  const height = contents.readUInt32BE(20);

  if (actualHash !== expectedHash) {
    failures.push(`${relativePath}: expected ${expectedHash}, received ${actualHash}`);
  }
  if (width !== 1440 || height !== 1080) {
    failures.push(`${relativePath}: expected 1440x1080, received ${width}x${height}`);
  }
}

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}

console.log("Figma hardened render hashes and dimensions verified.");
