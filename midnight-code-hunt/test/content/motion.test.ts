// Requirement 14.3: reduced-motion rule is present.
import { join } from "node:path";
import { expect, it } from "vitest";
import { APP_ROOT, read } from "../support/files";

it("index.css disables animation and transition under prefers-reduced-motion", () => {
  const css = read(join(APP_ROOT, "src", "styles", "index.css"));
  const m = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*)\}/.exec(css);
  expect(m).not.toBeNull();
  expect(m![1]).toMatch(/animation:\s*none/);
  expect(m![1]).toMatch(/transition:\s*none/);
});
