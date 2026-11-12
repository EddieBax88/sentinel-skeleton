import { describe, expect, it } from "vitest";
import {
  gradeTrail,
  validateCodeTrail,
  NO_PARTS,
  type CodeTrail,
  type DrillDef,
} from "@sentinel/skeleton-core";

// Fictional trail (not real NEC content) used only to prove the Core alias resolves from source.
const trail: CodeTrail = {
  keyword: "Widget",
  legs: [
    [
      { level: "chapter", value: "Chapter 3" },
      { level: "article", value: "Article 999" },
      { level: "section", value: "999.10" },
    ],
  ],
};

describe("Core alias smoke test", () => {
  it("validates a fictional trail", () => {
    expect(validateCodeTrail(trail)).toEqual({ ok: true });
  });

  it("grades the matching picks as matched: true", () => {
    const drill: DrillDef = { trails: [trail] };
    const result = gradeTrail(drill, [
      { level: "chapter", value: "Chapter 3" },
      { level: "article", value: "Article 999" },
      { level: "part", value: NO_PARTS },
      { level: "section", value: "999.10" },
    ]);
    expect(result.matched).toBe(true);
  });
});
