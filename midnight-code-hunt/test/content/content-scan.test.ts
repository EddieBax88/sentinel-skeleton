// Content scan. Covers Requirements 1.11, 16.4-16.8, 16.10, 16.12, 16.13.
// Scans app source, drill data fixtures, and docs for banned terms.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BANNED_RULES } from "../support/bannedTerms";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SKIP_DIRS = new Set(["node_modules", "dist"]);
const TEXT_EXT = /\.(?:ts|tsx|css|html|md|json|mjs|svg|txt)$|\.env\.example$/;
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const LIST_FILE = join(ROOT, "test", "support", "bannedTerms.ts");

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p, out);
    } else if (TEXT_EXT.test(name) && !TEST_FILE.test(name) && p !== LIST_FILE) {
      out.push(p);
    }
  }
}

function filesToScan(): string[] {
  const out: string[] = [];
  walk(join(ROOT, "src"), out);
  walk(join(ROOT, "test", "fixtures"), out);
  walk(join(ROOT, "public"), out);
  walk(join(ROOT, "docs"), out);
  for (const f of ["index.html", "README.md", ".env.example"]) {
    const p = join(ROOT, f);
    if (existsSync(p)) out.push(p);
  }
  return out;
}

describe("content scan", () => {
  const files = filesToScan();

  it("finds files to scan and excludes the list file and test files", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).not.toContain(LIST_FILE);
    expect(files.some((f) => TEST_FILE.test(f))).toBe(false);
  });

  it("finds no banned term in UI copy, drill data, or docs", () => {
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = relative(ROOT, file).split(sep).join("/");
      for (const r of BANNED_RULES) {
        for (const m of text.matchAll(r.pattern)) {
          const line = text.slice(0, m.index).split("\n").length;
          hits.push(`${rel}:${line} [${r.id}] "${m[0]}"`);
        }
      }
    }
    expect(hits, `Banned terms found:\n${hits.join("\n")}`).toEqual([]);
  });
});
