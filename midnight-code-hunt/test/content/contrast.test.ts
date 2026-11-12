// Requirements 13.6, 13.7, 14.3: WCAG contrast for theme token pairs in use.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../support/contrast";
import { APP_ROOT, read } from "../support/files";

const css = read(join(APP_ROOT, "src", "styles", "theme.css"));
const token = (name: string): string => {
  const m = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`Missing token ${name}`);
  return m[1].trim();
};

const backgrounds = ["night", "surface"];
const textTokens = ["ink", "muted", "danger", "ok", "primary"];

describe("text contrast (>= 4.5:1)", () => {
  for (const fg of textTokens) {
    for (const bg of backgrounds) {
      it(`${fg} on ${bg}`, () => {
        expect(contrastRatio(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("focus outline and boundaries (>= 3:1)", () => {
  for (const bg of backgrounds) {
    it(`primary outline on ${bg}`, () => {
      expect(contrastRatio(token("primary"), token(bg))).toBeGreaterThanOrEqual(3);
    });
  }
  it("muted boundary on night", () => {
    expect(contrastRatio(token("muted"), token("night"))).toBeGreaterThanOrEqual(3);
  });
});

describe("contrast helper", () => {
  it("black on white is 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
});
