// Boundary check: dist/index.js and every file it reaches via relative
// imports must not reference "fast-check". Does not build; run build first.
// Usage: node scripts/check-no-fast-check.mjs [distDir]
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(process.argv[2] ?? resolve(here, "..", "dist"));
const entry = resolve(distDir, "index.js");

if (!existsSync(entry)) {
  console.error(`boundary check: entry not found: ${entry} (run the build first)`);
  process.exit(2);
}

// Matches static/re-export `from "./x"`, side-effect `import "./x"`, and dynamic `import("./x")`.
const specRe =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']*)["']/g;

const seen = new Set();
const offenders = [];
const queue = [entry];

while (queue.length > 0) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  if (!existsSync(file)) {
    console.error(`boundary check: unresolved relative import target: ${file}`);
    process.exit(2);
  }
  const src = readFileSync(file, "utf8");
  if (src.includes("fast-check")) offenders.push(file);
  for (const m of src.matchAll(specRe)) {
    queue.push(resolve(dirname(file), m[1]));
  }
}

if (offenders.length > 0) {
  console.error('boundary check FAILED: "fast-check" referenced in the main entry graph:');
  for (const f of offenders.sort()) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`boundary check passed: ${seen.size} file(s) scanned, no "fast-check" reference.`);
