import { gradeTrail } from "@sentinel/skeleton-core";
import type { CodeTrail } from "@sentinel/skeleton-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import { methodOf } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode } from "../model/types";
import { buildNamesIndex, resolveDisplay } from "./displayName";
import { gradeAttempt, selectGradingInput } from "./grading";
import { buildGradePicks, keywordOf } from "./pickBuilder";

// Feature: midnight-code-hunt, Property 24: Result rows are built from the Core result
// **Validates: Requirements 10.5, 10.6, 10.7, 10.8, 11.2, 11.6, 11.9, 11.13**

const names = buildNamesIndex({
  y2023: { edition: 2023, entries: [] },
  y2026: { edition: 2026, entries: [] },
});

const norm = (s: string): string => s.trim().toLowerCase();

const stepsOf = (trail: CodeTrail) => trail.legs.flatMap((leg) => leg);

type Shape = {
  /** 0 = no keyword at all; 1 = keyword only; larger = keyword plus steps. */
  prefix: number;
  mutate: readonly boolean[];
  extras: number;
  misfire: boolean;
  badKeyword: boolean;
  useMoved: boolean;
  useIndex: boolean;
  which: number;
  timeUp: boolean;
};

const arbCase = fc.record({
  drill: arbDrill,
  shape: fc.record({
    prefix: fc.integer({ min: 0, max: 12 }),
    mutate: fc.array(fc.boolean(), { minLength: 12, maxLength: 12 }),
    extras: fc.integer({ min: 0, max: 3 }),
    misfire: fc.boolean(),
    badKeyword: fc.boolean(),
    useMoved: fc.boolean(),
    useIndex: fc.boolean(),
    which: fc.nat(),
    timeUp: fc.boolean(),
  }),
});

function build(drill: DrillRecord, s: Shape) {
  const method: MethodId = s.useIndex && drill.index_checked ? "index" : "toc";
  const methodTrails: CodeTrail[] = drill.def.trails.filter((t) => methodOf(t) === method);
  const moved: CodeTrail | undefined =
    method === "toc" && s.useMoved ? drill.def.movedFrom : undefined;
  const source: CodeTrail = moved ?? methodTrails[s.which % methodTrails.length]!;
  if (s.prefix === 0) return { method, path: [] as OptionNode[] };

  const steps = stepsOf(source);
  const nodes: OptionNode[] = [
    {
      level: "keyword",
      value: s.badKeyword ? `${source.keyword} (not a keyword)` : source.keyword,
      role: "correct",
    },
  ];
  steps.slice(0, s.prefix - 1).forEach((step, i) => {
    nodes.push({
      level: step.level as OptionNode["level"],
      value: s.mutate[i] && step.level !== "part" ? `${step.value} zz` : step.value,
      role: "correct",
    } as OptionNode);
  });
  if (s.prefix - 1 >= steps.length) {
    if (s.misfire && !steps.some((st) => st.level === "part")) {
      nodes.splice(1, 0, { level: "part", value: "Part Z", role: "wrong" });
    }
    for (let i = 0; i < s.extras; i++) {
      nodes.push({ level: "section", value: `Extra ${i}`, role: "wrong" });
    }
  }
  return { method, path: nodes };
}

describe("Property 24: Result rows are built from the Core result", () => {
  it("rows mirror the Core result and obey the row rules", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, shape }) => {
        const { method, path } = build(drill, shape);
        const outcome = { timeUp: shape.timeUp, elapsedSeconds: 5 };
        const result = gradeAttempt(drill, method, path, names, outcome);
        const rows = result.rows;

        // Independent Core result.
        const sel = selectGradingInput(drill, method, keywordOf(path));
        const core = gradeTrail(sel.drillDef, buildGradePicks(path));

        // First row is the Keyword row.
        expect(rows[0]?.kind).toBe("keyword");
        const kw = rows[0]!;
        if (path.length === 0) {
          expect(kw.kind === "keyword" && kw.verdict).toBe("unanswered");
          expect(kw.kind === "keyword" && kw.pickText).toBeUndefined();
        } else {
          const trailKeywords = drill.def.trails
            .filter((t) => methodOf(t) === method)
            .map((t) => norm(t.keyword));
          const expected = trailKeywords.includes(norm(path[0]!.value)) ? "correct" : "incorrect";
          expect(kw.kind === "keyword" && kw.verdict).toBe(expected);
        }

        // Step rows equal the Core stepResults, in order.
        const stepRows = rows.filter((r) => r.kind === "step");
        expect(stepRows.map((r) => (r.kind === "step" ? [r.level, r.verdict] : []))).toEqual(
          core.stepResults.map((r) => [r.level, r.verdict]),
        );
        expect(rows.slice(1, 1 + stepRows.length)).toEqual(stepRows);

        const picksMade = Math.max(path.length - 1, 0);
        for (const row of rows) {
          expect(["correct", "incorrect", "unanswered"]).toContain(
            row.kind === "row-line" ? "correct" : row.verdict,
          );
          if (row.kind === "step") {
            if (row.synthetic) {
              expect(row.level).toBe("part");
              expect(row.verdict).toBe("incorrect");
            }
            // No pick means unanswered, never incorrect (also on expiry).
            if (row.pickText === undefined) expect(row.verdict).toBe("unanswered");
            // Fork sentences only on the matching level and only when present.
            const expectedFork =
              row.level === "chapter"
                ? drill.chapterForkSentence
                : row.level === "article"
                  ? drill.articleForkSentence
                  : undefined;
            expect(row.forkSentence).toBe(expectedFork);
            if (expectedFork === undefined) expect("forkSentence" in row).toBe(false);
          }
          if (row.kind === "extra") expect(row.verdict).toBe("incorrect");
        }

        // Extra rows come after the step rows and before any row-line.
        const firstExtra = rows.findIndex((r) => r.kind === "extra");
        if (firstExtra >= 0) {
          expect(firstExtra).toBeGreaterThanOrEqual(1 + stepRows.length);
          expect(rows.slice(firstExtra).every((r) => r.kind === "extra" || r.kind === "row-line")).toBe(
            true,
          );
        }

        // Pick text comes from the display resolver for some path node.
        const texts = path.map((n) => resolveDisplay(n, names).text);
        for (const row of rows) {
          if ((row.kind === "step" || row.kind === "keyword") && row.pickText !== undefined) {
            expect(texts).toContain(row.pickText);
          }
        }
        expect(rows.filter((r) => r.kind === "extra").length).toBeLessThanOrEqual(picksMade);

        // Row-line row exists iff the drill has a tableWalk.
        const rowLines = rows.filter((r) => r.kind === "row-line");
        expect(rowLines.length).toBe(drill.tableWalk === undefined ? 0 : 1);
        if (drill.tableWalk !== undefined) {
          expect(rowLines[0]).toEqual({ kind: "row-line", tableWalk: drill.tableWalk });
        }

        // Expiry does not change the rows.
        const other = gradeAttempt(drill, method, path, names, {
          timeUp: !shape.timeUp,
          elapsedSeconds: 5,
        });
        expect(other.rows).toEqual(rows);
      }),
      { numRuns: 200 },
    );
  });

  it("a pure prefix of a single matching trail pairs picks to rows by position", () => {
    fc.assert(
      fc.property(arbCase, ({ drill, shape }) => {
        const s: Shape = { ...shape, badKeyword: false, useMoved: false, misfire: false, extras: 0 };
        const { method, path } = build(drill, s);
        if (path.length === 0) return;
        const sel = selectGradingInput(drill, method, keywordOf(path));
        if (sel.drillDef.trails.length !== 1) return;
        const result = gradeAttempt(drill, method, path, names, { timeUp: false, elapsedSeconds: 1 });
        const stepRows = result.rows.filter((r) => r.kind === "step");
        stepRows.forEach((row, i) => {
          const node = path[i + 1];
          if (row.kind !== "step") return;
          if (node === undefined) {
            expect(row.pickText).toBeUndefined();
            expect(row.verdict).toBe("unanswered");
          } else {
            expect(row.pickText).toBe(resolveDisplay(node, names).text);
          }
        });
      }),
      { numRuns: 200 },
    );
  });

  it("zero picks give an unanswered Keyword row, unanswered step rows, and an incorrect result", () => {
    fc.assert(
      fc.property(fc.record({ drill: arbDrill, useIndex: fc.boolean(), timeUp: fc.boolean() }), (c) => {
        const method: MethodId = c.useIndex && c.drill.index_checked ? "index" : "toc";
        const result = gradeAttempt(c.drill, method, [], names, {
          timeUp: c.timeUp,
          elapsedSeconds: 0,
        });
        expect(result.overall).toBe("incorrect");
        expect(result.rows[0]).toEqual({ kind: "keyword", verdict: "unanswered" });
        const steps = result.rows.filter((r) => r.kind === "step");
        expect(steps.length).toBeGreaterThan(0);
        for (const r of steps) {
          expect(r.kind === "step" && r.verdict).toBe("unanswered");
          expect(r.kind === "step" && r.synthetic).toBe(false);
        }
        expect(result.rows.some((r) => r.kind === "extra")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
