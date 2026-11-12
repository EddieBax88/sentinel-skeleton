// Tests for scripts/check-bundle.mjs against temporary directories.
// Requirements: 1.9, 1.11, 1.12, 17.19
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "./check-bundle.mjs";

let root: string;

function put(rel: string, text: string): string {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, text);
  return full;
}

function check(): { code: number; output: string } {
  const lines: string[] = [];
  const code = run(root, (line: string) => lines.push(line)) as number;
  return { code, output: lines.join("\n") };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "check-bundle-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("check-bundle", () => {
  it("exits zero for a clean dist", () => {
    put("dist/index.html", "<html></html>");
    put("dist/assets/app.js", "console.log('hi');");
    expect(check()).toEqual({ code: 0, output: "" });
  });

  it("exits zero when dist/ does not exist", () => {
    expect(check().code).toBe(0);
  });

  it("fails and names each file containing fast-check", () => {
    const a = put("dist/assets/app.js", "import 'fast-check';");
    const b = put("dist/assets/nested/chunk.js", "/* fast-check */");
    const clean = put("dist/assets/ok.js", "x");
    const { code, output } = check();
    expect(code).not.toBe(0);
    expect(output).toContain(a);
    expect(output).toContain(b);
    expect(output).not.toContain(clean);
  });

  it("ignores fast-check outside dist/", () => {
    put("src/a.ts", 'import fc from "fast-check";');
    put("dist/app.js", "ok");
    expect(check().code).toBe(0);
  });
});
