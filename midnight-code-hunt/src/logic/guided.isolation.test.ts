import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbDrill } from "../../test/support/arbitraries";
import type { DrillRecord, OptionNode } from "../model/types";
import { createGuidedReducer, type GuidedEvent, type GuidedState } from "./guided";

// Feature: midnight-code-hunt, Property 39: Guided reads no clock and no store
// **Validates: Requirements 19.1, 19.11**

const source = readFileSync(resolve(__dirname, "guided.ts"), "utf8");

/** Module specifiers of every import and export-from statement in the source text. */
function importSpecifiers(text: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;
  for (const m of text.matchAll(re)) out.push((m[1] ?? m[2]) as string);
  return out;
}

function collectValues(nodes: readonly OptionNode[] | undefined, into: string[]): void {
  for (const n of nodes ?? []) {
    into.push(n.value);
    collectValues(n.next, into);
  }
}

const arbEventsFor = (drill: DrillRecord): fc.Arbitrary<GuidedEvent[]> => {
  const values: string[] = ["not-an-option"];
  collectValues(drill.trees.toc, values);
  collectValues(drill.trees.index, values);
  const arbEvent: fc.Arbitrary<GuidedEvent> = fc.oneof(
    { weight: 6, arbitrary: fc.record({ type: fc.constant("PICK" as const), depth: fc.nat({ max: 6 }), value: fc.constantFrom(...values) }) },
    { weight: 2, arbitrary: fc.record({ type: fc.constant("SELECT_METHOD" as const), method: fc.constantFrom("index" as const, "toc" as const) }) },
    { weight: 1, arbitrary: fc.constant<GuidedEvent>({ type: "FINISH" }) },
    { weight: 1, arbitrary: fc.constant<GuidedEvent>({ type: "LEAVE" }) },
    { weight: 1, arbitrary: fc.constant<GuidedEvent>({ type: "START", drill }) },
  );
  return fc.array(arbEvent, { maxLength: 25 });
};

const run = (drill: DrillRecord, events: readonly GuidedEvent[]): GuidedState => {
  const reduce = createGuidedReducer();
  return events.reduce<GuidedState>(reduce, reduce({ phase: "idle" }, { type: "START", drill }));
};

describe("Guided isolation (Property 39)", () => {
  it("guided.ts imports neither timer nor bestTimes", () => {
    const specs = importSpecifiers(source);
    expect(specs.length).toBeGreaterThan(0);
    for (const s of specs) {
      expect(s).not.toMatch(/timer/i);
      expect(s).not.toMatch(/bestTimes/i);
    }
  });

  it("guided.ts names no clock or storage API", () => {
    expect(source).not.toMatch(/\b(Date\.now|performance\.now|localStorage|sessionStorage|setTimeout|setInterval)\b/);
  });

  it("the reducer result depends only on the events and the drill", () => {
    fc.assert(
      fc.property(
        arbDrill.chain((drill) => fc.tuple(fc.constant(drill), arbEventsFor(drill))),
        ([drill, events]) => {
          const first = run(structuredClone(drill), events);
          const second = run(structuredClone(drill), events);
          expect(second).toEqual(first);
        },
      ),
      { numRuns: 100 },
    );
  });
});
