// Requirements 13.8, 1.10: no external assets; the only absolute URL is the Sentinel link.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SENTINEL_URL } from "../../src/copy/strings";
import { APP_ROOT, read, sourceFiles } from "../support/files";

const URL_RE = /(?:https?:)?\/\/[a-z0-9][^\s"'`)<>]*/gi;
const files = [join(APP_ROOT, "index.html"), ...sourceFiles()];

describe("external requests", () => {
  it("index.html and css reference no remote assets, fonts, or scripts", () => {
    for (const f of files.filter((p) => /\.(html|css)$/.test(p))) {
      const text = read(f).replace(/\bxmlns="[^"]*"/g, "");
      expect(text.match(URL_RE) ?? [], f).toEqual([]);
      expect(text, f).not.toMatch(/@import\s+(?:url\()?["']?(?:https?:)?\/\//i);
    }
  });

  it("the only absolute URL in source is the Sentinel link", () => {
    const abs: string[] = [];
    for (const f of files.filter((p) => /\.(tsx?|html|css)$/.test(p))) {
      for (const m of read(f).matchAll(/https?:\/\/[^\s"'`)<>]+/gi)) {
        // Prefix checks in the switcher validator are not URLs.
        if (/^https?:\/\/$/.test(m[0])) continue;
        abs.push(m[0]);
      }
    }
    expect([...new Set(abs)]).toEqual([SENTINEL_URL]);
  });
});
