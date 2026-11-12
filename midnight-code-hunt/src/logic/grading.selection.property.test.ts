import { gradeTrail } from "@sentinel/skeleton-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { methodOf } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode } from "../model/types";
import { buildNamesIndex } from "./displayName";
import { gradeAttempt, selectGradingInput } from "./grading";
import type { GradeDeps } from "./grading";

// Feature: midnight-code-hunt, Property 21: Grading input selection
// **Validates: Requirements 10.2, 10.3, 10.4, 10.5**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});
const outcome = { timeUp: false, elapsedSeconds: 1 };

const norm = (s: string): string => s.trim().toLowerCase();

type PickKind = "trail" | "moved" | "random" | "none";

const arbCase = fc
  .record({
    drill: arbDrill,
    useIndex: fc.boolean(),
    kind: fc.constantFrom<PickKind>("trail", "moved", "random", "none"),
    which: fc.nat(),
    random: fc.string({ minLength: 1, maxLength: 20 }),
    upper: fc.boolean(),
    pad: fc.constantFrom("", " ", "  \t"),
    extraCount: fc.integer({ min: 0, max: 3 }),
  })
  .map((c) => {
    const method: MethodId = c.useIndex && c.drill.index_checked ? "index" : "toc";
    const methodTrails = c.drill.def.trails.filter((t) => methodOf(t) === method);
    let base: string | undefined;
    if (c.kind === "trail") base = methodTrails[c.which % methodTrails.length]?.keyword;
    else if (c.kind === "moved") base = c.drill.def.movedFrom?.keyword ?? c.random;
    else if (c.kind === "random") base = c.random;
    const pick =
      base === undefined ? undefined : `${c.pad}${c.upper ? base.toUpperCase() : base}${c.pad}`;
    return { drill: c.drill, method, pick, extraCount: c.extraCount };
  });

function pathOf(pick: string | undefined, extraCount: number): OptionNode[] {
  if (pick === undefined) return [];
  const extras: OptionNode[] = Array.from({ length: extraCount }, (_, i) => ({
    level: "section" as const,
    value: `Section ${i}`,
    role: "wrong" as const,
  }));
  return [{ level: "keyword", value: pick, role: "correct" }, ...extras];
}

function countingDeps(): { deps: GradeDeps; calls: () => number } {
  let n = 0;
  return {
    deps: {
      gradeTrail: ((...args: Parameters<typeof gradeTrail>) => {
        n += 1;
        return gradeTrail(...args);
      }) as typeof gradeTrail,
    },
    calls: () => n,
  };
}

describe("Property 21: Grading input selection", () => {
  it("selectGradingInput picks the matching trails, or all method trails with no movedFrom", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, method, pick }) => {
        const sel = selectGradingInput(drill, method, pick);
        const methodTrails = drill.def.trails.filter((t) => methodOf(t) === method);
        const p = pick === undefined ? undefined : norm(pick);
        const matching = p === undefined ? [] : methodTrails.filter((t) => norm(t.keyword) === p);

        if (matching.length > 0) {
          expect(sel.keywordCorrect).toBe(true);
          expect(sel.drillDef.trails).toEqual(matching);
          const mf = drill.def.movedFrom;
          const expectMoved = method === "toc" && mf !== undefined && norm(mf.keyword) === p;
          if (expectMoved) expect(sel.drillDef.movedFrom).toEqual(mf);
          else expect(sel.drillDef.movedFrom).toBeUndefined();
        } else {
          expect(sel.keywordCorrect).toBe(false);
          expect(sel.drillDef.trails).toEqual(methodTrails);
          expect(sel.drillDef.movedFrom).toBeUndefined();
        }
        if (method === "index") expect(sel.drillDef.movedFrom).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });

  it("gradeAttempt calls gradeTrail exactly once, including zero picks, and is incorrect without a keyword match", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, method, pick, extraCount }) => {
        const { deps, calls } = countingDeps();
        const path = pathOf(pick, extraCount);
        const result = gradeAttempt(drill as DrillRecord, method, path, names, outcome, deps);
        expect(calls()).toBe(1);
        const sel = selectGradingInput(drill, method, pick);
        if (!sel.keywordCorrect) expect(result.overall).toBe("incorrect");
      }),
      { numRuns: 200 },
    );
  });
});
