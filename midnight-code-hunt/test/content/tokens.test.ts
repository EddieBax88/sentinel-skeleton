// Requirements 13.4, 13.6: theme values are defined once, in src/styles/theme.css.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_ROOT, read, sourceFiles } from "../support/files";

const THEME = join(APP_ROOT, "src", "styles", "theme.css");

describe.each(["#050607", "oklch(0.83 0.185 88)"])("token %s", (token) => {
  it("appears in exactly one file under src/, styles/theme.css", () => {
    const hits = sourceFiles().filter((f) =>
      read(f).toLowerCase().includes(token.toLowerCase()),
    );
    expect(hits).toEqual([THEME]);
  });
});
