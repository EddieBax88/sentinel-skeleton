import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { methodOf } from "../model/methods";
import type { MethodId, OptionNode } from "../model/types";
import { buildNamesIndex } from "./displayName";
import { gradeAttempt } from "./grading";

// Feature: midnight-code-hunt, Property 22: Grading is deterministic
// **Validates: Requirements 10.12**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const LEVELS = ["chapter", "article", "part", "section", "table", "row"] as const;
const ROLES = ["correct", "moved", "wrong"] as const;

const arbNode = fc.record({
  level: fc.constantFrom(...LEVELS),
  value: fc.string({ minLength: 1, maxLength: 20 }),
  role: fc.constantFrom(...ROLES),
});

const arbCase = fc
  .record({
    drill: arbDrill,
    useIndex: fc.boolean(),
    keywordKind: fc.constantFrom("trail", "moved", "random", "none"),
    which: fc.nat(),
    random: fc.string({ minLength: 1, maxLength: 20 }),
    steps: fc.array(arbNode, { maxLength: 6 }),
    timeUp: fc.boolean(),
    elapsedSeconds: fc.integer({ min: 0, max: 100000 }),
  })
  .map((c) => {
    const method: MethodId = c.useIndex && c.drill.index_checked ? "index" : "toc";
    const methodTrails = c.drill.def.trails.filter((t) => methodOf(t) === method);
    let keyword: string | undefined;
    if (c.keywordKind === "trail") keyword = methodTrails[c.which % methodTrails.length]?.keyword;
    else if (c.keywordKind === "moved") keyword = c.drill.def.movedFrom?.keyword ?? c.random;
    else if (c.keywordKind === "random") keyword = c.random;
    const path: OptionNode[] =
      keyword === undefined
        ? []
        : [{ level: "keyword", value: keyword, role: "correct" }, ...(c.steps as OptionNode[])];
    return {
      drill: c.drill,
      method,
      path,
      outcome: { timeUp: c.timeUp, elapsedSeconds: c.elapsedSeconds },
    };
  });

describe("Property 22: Grading is deterministic", () => {
  it("gradeAttempt called twice with the same arguments returns deeply equal results", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, method, path, outcome }) => {
        const first = gradeAttempt(drill, method, path, names, outcome);
        const second = gradeAttempt(drill, method, path, names, outcome);
        expect(second).toEqual(first);
      }),
      { numRuns: 200 },
    );
  });
});
