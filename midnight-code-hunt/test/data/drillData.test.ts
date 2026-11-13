// Data test: validateDrillData over the real library and over valid fictional fixtures.
// **Validates: Requirements 2.11, 2.12, 2.13, 2.14, 3.8, 4.8, 17.1-17.9, 17.20**
import { describe, expect, it } from "vitest";
import { checkedNames2023 } from "../../src/data/checkedNames2023";
import { checkedNames2026 } from "../../src/data/checkedNames2026";
import { DRILL_LIBRARY } from "../../src/data/drillLibrary";
import { validateDrillData } from "../../src/data/validateDrillData";
import type { DataIssue } from "../../src/data/validateDrillData";
import { CLEAN_NAMES } from "../fixtures/fictionalNames";
import { FIXTURE_DRILLS } from "../fixtures/fixtureDrills";
import { GUIDED_FIXTURE_DRILLS } from "../fixtures/guidedDrills";

const describeIssues = (issues: readonly DataIssue[]): string =>
  issues.map((i) => `${i.drillId} [${i.rule}] ${i.message}`).join("\n");

describe("drill data", () => {
  it("DRILL_LIBRARY has zero issues against the real names files (any founder_checked value)", () => {
    const issues = validateDrillData(DRILL_LIBRARY, {
      y2023: checkedNames2023,
      y2026: checkedNames2026,
    });
    expect(issues, describeIssues(issues)).toEqual([]);
  });

  it("valid fixture drills have zero issues against fictional names", () => {
    expect(FIXTURE_DRILLS.length).toBeGreaterThan(0);
    const issues = validateDrillData(FIXTURE_DRILLS, CLEAN_NAMES);
    expect(issues, describeIssues(issues)).toEqual([]);
  });

  // Validates: Requirements 20.6, 22.1, 22.2, 22.3
  it("valid Guided fixtures (all, some, and no why) have zero issues", () => {
    expect(GUIDED_FIXTURE_DRILLS.length).toBeGreaterThan(0);
    const issues = validateDrillData(GUIDED_FIXTURE_DRILLS, CLEAN_NAMES);
    expect(issues, describeIssues(issues)).toEqual([]);
  });
});
