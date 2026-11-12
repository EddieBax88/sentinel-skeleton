// Tests for scripts/check-static.mjs against temporary directories.
// Requirements: 1.9, 1.11, 1.12, 17.19
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "./check-static.mjs";

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
  root = mkdtempSync(path.join(tmpdir(), "check-static-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("check-static", () => {
  it("exits zero for clean source", () => {
    put("src/clean.ts", 'import { a } from "./other";\nexport const b = a;\n');
    put("src/other.ts", "export const a = 1;\n");
    expect(check()).toEqual({ code: 0, output: "" });
  });

  it("exits zero when src/ does not exist", () => {
    expect(check().code).toBe(0);
  });

  it("fails and names a file containing a network word", () => {
    const bad = put("src/net.ts", "export const x = () => fetch('/a');\n");
    const { code, output } = check();
    expect(code).not.toBe(0);
    expect(output).toContain(bad);
  });

  it("flags a network word inside a comment", () => {
    const bad = put("src/comment.ts", "// uses XMLHttpRequest\nexport {};\n");
    const { code, output } = check();
    expect(code).not.toBe(0);
    expect(output).toContain(bad);
  });

  it("fails and names a file with a deep Core import", () => {
    const bad = put(
      "src/deep.ts",
      'import { x } from "@sentinel/skeleton-core/src/trail/grade";\nexport { x };\n',
    );
    const { code, output } = check();
    expect(code).not.toBe(0);
    expect(output).toContain(bad);
  });

  it("allows the package-root Core import", () => {
    put("src/ok.ts", 'import { defineCodeTrail } from "@sentinel/skeleton-core";\nexport { defineCodeTrail };\n');
    expect(check().code).toBe(0);
  });

  it("fails and names a non-test file importing fast-check", () => {
    const bad = put("src/fc.ts", 'import fc from "fast-check";\nexport { fc };\n');
    const { code, output } = check();
    expect(code).not.toBe(0);
    expect(output).toContain(bad);
  });

  it("allows fast-check in a test file", () => {
    put("src/fc.test.ts", 'import fc from "fast-check";\nexport { fc };\n');
    expect(check().code).toBe(0);
  });

  it("names every offending file and not clean ones", () => {
    const a = put("src/a.ts", "fetch('x');\n");
    const b = put("src/b.ts", 'import fc from "fast-check";\n');
    const clean = put("src/clean.ts", "export const c = 1;\n");
    const { output } = check();
    expect(output).toContain(a);
    expect(output).toContain(b);
    expect(output).not.toContain(clean);
  });

  describe("test-import rule", () => {
    it("fails a non-test file under src/ importing test/", () => {
      const bad = put("src/app.ts", 'import { s } from "../test/support/setup";\nexport { s };\n');
      put("test/support/setup.ts", "export const s = 1;\n");
      const { code, output } = check();
      expect(code).not.toBe(0);
      expect(output).toContain(bad);
    });

    it("fails a non-test file importing a fixtures folder", () => {
      const bad = put("src/app.tsx", 'import data from "./fixtures/data";\nexport default data;\n');
      const { code, output } = check();
      expect(code).not.toBe(0);
      expect(output).toContain(bad);
    });

    it.each(["src/x.test.ts", "src/x.test.tsx"])(
      "passes %s importing test/support and test/fixtures",
      (rel) => {
        put(
          rel,
          'import { s } from "../test/support/setup";\nimport { f } from "../test/fixtures/data";\nexport { s, f };\n',
        );
        expect(check()).toEqual({ code: 0, output: "" });
      },
    );
  });
});
