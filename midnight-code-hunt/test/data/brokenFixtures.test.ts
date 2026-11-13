// Validates: Requirements 17.2, 17.4, 17.6, 17.7, 17.8, 17.9
import { describe, expect, it } from "vitest";
import { validateDrillData } from "../../src/data/validateDrillData";
import { BROKEN_CASES } from "../fixtures/brokenDrills";
import { CLEAN_NAMES } from "../fixtures/fictionalNames";
import { FIXTURE_DRILLS } from "../fixtures/fixtureDrills";

describe("broken fixtures", () => {
  it.each(BROKEN_CASES.map((c) => [`${c.rule} (${c.drillId}): ${c.description}`, c] as const))(
    "%s",
    (_label, c) => {
      const issues = validateDrillData(c.drills, c.names);
      const hit = issues.filter((i) => i.rule === c.rule && i.drillId === c.drillId);
      expect(hit.length, JSON.stringify(issues, null, 2)).toBeGreaterThan(0);
    },
  );

  // Validates: Requirements 20.6, 22.1, 22.2, 22.3
  it.each(
    BROKEN_CASES.filter((c) => c.rule.startsWith("R20.")).map(
      (c) => [`${c.rule} (${c.drillId}): ${c.description}`, c] as const,
    ),
  )("Why_Sentence fixture reports exactly its rule code and drill id: %s", (_label, c) => {
    const issues = validateDrillData(c.drills, c.names);
    expect(issues.length, JSON.stringify(issues, null, 2)).toBeGreaterThan(0);
    for (const i of issues) {
      expect(i.rule).toBe(c.rule);
      expect(i.drillId).toBe(c.drillId);
    }
  });

  it("covers each rule code at least once", () => {
    expect(new Set(BROKEN_CASES.map((c) => c.rule)).size).toBeGreaterThanOrEqual(20);
  });

  it("reports no issues for the clean fixtures with clean names", () => {
    const issues = validateDrillData(FIXTURE_DRILLS, CLEAN_NAMES);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
  });

  it.each(FIXTURE_DRILLS.map((d) => [d.def.id, d] as const))(
    "clean fixture %s adds no rule beyond what a broken case expects",
    (_id, d) => {
      expect(validateDrillData([d], CLEAN_NAMES)).toEqual([]);
    },
  );
});
