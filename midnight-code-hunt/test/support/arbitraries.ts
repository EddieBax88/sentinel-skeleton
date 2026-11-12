// Test-only fast-check generators. Everything here is fictional; no real NEC
// content. Production code never imports this file.
import fc from "fast-check";
import type { CodeTrail, CodeTrailDef, TrailStep } from "@sentinel/skeleton-core";
import type { DrillRecord, TableWalk } from "../../src/model/types";
import type { StorageLike } from "../../src/logic/bestTimes";
import { treeFromTrails, type DecoyPool } from "./buildTree";

export type TrailKind = "main-chapter" | "chapter9-table" | "annex" | "article90" | "index";

const WORDS = [
  "alpha", "bramble", "cinder", "dusk", "ember", "fennel", "gourd", "hollow",
  "ivy", "juniper", "kettle", "lantern", "marrow", "nettle", "orchard", "pumpkin",
] as const;
const ROMAN = ["I", "II", "III", "IV", "V"] as const; // never IX (reserved for decoys)
const LETTERS = ["A", "B", "C", "D", "E"] as const;

const word = fc.constantFrom(...WORDS);

/** Fictional keyword, 1-200 chars, never blank. */
export const arbKeyword: fc.Arbitrary<string> = fc
  .tuple(word, fc.integer({ min: 1, max: 9 }))
  .map(([w, n]) => `fictional ${w} ${n}`);

const arbSubdivision: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom(...LETTERS).map((l) => `(${l})`),
  fc.integer({ min: 1, max: 9 }).map((n) => `(${n})`),
);

function step(level: TrailStep["level"], value: string): TrailStep {
  return { level, value };
}

function trail(keyword: string, steps: TrailStep[]): CodeTrail {
  return { keyword, legs: [steps as unknown as [TrailStep, ...TrailStep[]]] };
}

/**
 * Generates trails that pass `validateCodeTrail`. Numbers are fictional.
 * Article numbers for main trails are 100-999 (moved trails use 1000-1999).
 */
export function arbTrail(kind: TrailKind): fc.Arbitrary<CodeTrail> {
  const n = (min: number, max: number) => fc.integer({ min, max });
  switch (kind) {
    case "main-chapter":
      return fc
        .record({
          keyword: arbKeyword,
          chapter: n(1, 8),
          article: n(100, 999),
          part: fc.option(fc.constantFrom(...ROMAN), { nil: undefined }),
          end: fc.oneof(
            fc.record({
              type: fc.constant("table" as const),
              num: n(1, 9),
            }),
            fc.record({
              type: fc.constant("section" as const),
              num: n(1, 99),
              subs: fc.array(arbSubdivision, { maxLength: 2 }),
            }),
          ),
        })
        .map(({ keyword, chapter, article, part, end }) => {
          const steps: TrailStep[] = [
            step("chapter", `Chapter ${chapter}`),
            step("article", `Article ${article}`),
          ];
          if (part !== undefined) steps.push(step("part", `Part ${part}`));
          if (end.type === "table") {
            steps.push(step("table", `Table ${article}.${end.num}`));
          } else {
            steps.push(step("section", `${article}.${end.num}`));
            for (const s of end.subs) steps.push(step("section", s));
          }
          return trail(keyword, steps);
        });
    case "chapter9-table":
      return fc
        .record({ keyword: arbKeyword, num: n(1, 9) })
        .map(({ keyword, num }) =>
          trail(keyword, [step("chapter", "Chapter 9"), step("table", `Table 9.${num}`)]),
        );
    case "annex":
      return fc
        .record({
          keyword: arbKeyword,
          annex: fc.constantFrom(...LETTERS),
          num: n(1, 9),
        })
        .map(({ keyword, annex, num }) =>
          trail(keyword, [step("annex", `Annex ${annex}`), step("table", `Table ${annex}.${num}`)]),
        );
    case "article90":
      return fc
        .record({ keyword: arbKeyword, num: n(1, 9) })
        .map(({ keyword, num }) =>
          trail(keyword, [step("article", "Article 90"), step("section", `90.${num}`)]),
        );
    case "index":
      return fc
        .record({
          keyword: arbKeyword,
          entry: fc.tuple(word, word).map(([a, b]) => `fictional ${a}, ${b}`),
          target: fc.oneof(
            n(100, 999).chain((a) =>
              n(1, 99).map((m) => step("section", `${a}.${m}`)),
            ),
            n(1, 9).chain((a) =>
              n(1, 9).map((m) => step("table", `Table ${a}.${m}`)),
            ),
          ),
          subs: fc.array(arbSubdivision, { maxLength: 2 }),
        })
        .map(({ keyword, entry, target, subs }) =>
          trail(keyword, [
            step("index", entry),
            target,
            // Subdivisions follow a section only; a table ends the route.
            ...(target.level === "section" ? subs.map((s) => step("section", s)) : []),
          ]),
        );
  }
}

const TOC_KINDS = ["main-chapter", "chapter9-table", "annex", "article90"] as const;
type TocKind = (typeof TOC_KINDS)[number];

const norm = (s: string): string => s.trim().toLowerCase();

/** Distinct routes: two trails of one kind never share their first two steps
 * (index trails: their Index entry), so no route is a prefix of another. */
function routeKey(kind: TrailKind, t: CodeTrail): string {
  const leg = t.legs[0];
  const take = kind === "index" ? 1 : 2;
  return leg
    .slice(0, take)
    .map((s) => norm(s.value))
    .join("|");
}

function arbTrailsOf(kind: TrailKind, min: number, max: number): fc.Arbitrary<CodeTrail[]> {
  return fc.uniqueArray(arbTrail(kind), {
    minLength: min,
    maxLength: max,
    selector: (t) => routeKey(kind, t),
  });
}

/** A fictional 2023 route (Articles 1000-1999, so it never meets a valid route). */
const arbMovedTrail: fc.Arbitrary<CodeTrail> = fc
  .record({
    keyword: arbKeyword,
    chapter: fc.integer({ min: 1, max: 8 }),
    article: fc.integer({ min: 1000, max: 1999 }),
    num: fc.integer({ min: 1, max: 99 }),
  })
  .map(({ keyword, chapter, article, num }) =>
    trail(keyword, [
      step("chapter", `Chapter ${chapter}`),
      step("article", `Article ${article}`),
      step("section", `${article}.${num}`),
    ]),
  );

const arbDecoyPool: fc.Arbitrary<DecoyPool> = fc.array(
  fc.array(
    fc.tuple(word, fc.integer({ min: 1, max: 99 })).map(([w, k]) => `Decoy ${w} ${k}`),
    { maxLength: 7 }, // trimmed to 6 per level by treeFromTrails
  ),
  { maxLength: 12 },
);

const sentence = fc
  .array(word, { minLength: 3, maxLength: 8 })
  .map((ws) => `Fictional ${ws.join(" ")}.`);

const arbTableWalk: fc.Arbitrary<TableWalk> = fc
  .tuple(word, word, word)
  .map(([c, r, v]) => ({
    column: `Fictional column ${c}`,
    row: `Fictional row ${r}`,
    value: `Fictional value ${v}`,
  }));

/**
 * A fictional DrillRecord whose trees agree with its declared trails.
 * Rules it respects: `trees.index` exists exactly when `index_checked`, Index
 * trails exist only then, `founder_checked` implies `wrongOptionsReviewed`,
 * `movedFrom` only on main-chapter Table of Contents drills.
 */
export const arbDrill: fc.Arbitrary<DrillRecord> = fc
  .record({
    idSuffix: fc.nat({ max: 999999 }),
    tocKind: fc.constantFrom<TocKind>(...TOC_KINDS),
    indexChecked: fc.boolean(),
    reviewed: fc.boolean(),
    checkedFlag: fc.boolean(),
    withMoved: fc.boolean(),
    withTableWalk: fc.boolean(),
    chapterFork: fc.option(sentence, { nil: undefined }),
    articleFork: fc.option(sentence, { nil: undefined }),
    tableWalk: arbTableWalk,
    moved: arbMovedTrail,
    note: sentence,
    tocDecoys: arbDecoyPool,
    indexDecoys: arbDecoyPool,
  })
  .chain((r) =>
    fc
      .tuple(
        arbTrailsOf(r.tocKind, 1, 2),
        r.indexChecked ? arbTrailsOf("index", 1, 2) : fc.constant([] as CodeTrail[]),
      )
      .map(([tocTrails, indexTrails]): DrillRecord => {
        const movedFrom = r.withMoved && r.tocKind === "main-chapter" ? r.moved : undefined;
        const trails = [...tocTrails, ...indexTrails] as unknown as CodeTrailDef["trails"];
        const def: CodeTrailDef = {
          id: `fixture-drill-${r.idSuffix}`,
          label: `Fictional drill ${r.idSuffix}`,
          trails,
          hint: "Fictional hint for tests only.",
          ...(movedFrom ? { movedFrom, editionNote: r.note } : {}),
        };
        return {
          def,
          question: "Fictional question for tests only.",
          answer: "Fictional answer for tests only.",
          citation: "Fictional article 777",
          founder_checked: r.reviewed && r.checkedFlag,
          index_checked: r.indexChecked,
          wrongOptionsReviewed: r.reviewed,
          ...(r.chapterFork !== undefined ? { chapterForkSentence: r.chapterFork } : {}),
          ...(r.articleFork !== undefined ? { articleForkSentence: r.articleFork } : {}),
          ...(r.withTableWalk ? { tableWalk: r.tableWalk } : {}),
          trees: {
            toc: treeFromTrails(tocTrails, movedFrom, r.tocDecoys),
            ...(r.indexChecked
              ? { index: treeFromTrails(indexTrails, undefined, r.indexDecoys) }
              : {}),
          },
        };
      }),
  );

export type StorageKind = "healthy" | "throws-on-read" | "throws-on-write" | "arbitrary";
export type ArbStorageValue = StorageLike & { readonly kind: StorageKind };

/** Storage that is healthy, throws on read, throws on write, or answers every
 * read with an arbitrary string (or null). */
export const arbStorage: fc.Arbitrary<ArbStorageValue> = fc
  .record({
    kind: fc.constantFrom<StorageKind>("healthy", "throws-on-read", "throws-on-write", "arbitrary"),
    junk: fc.option(
      fc.oneof(fc.string({ maxLength: 40 }), fc.constantFrom("NaN", "-1", "{}", "null", "1e999", "")),
      { nil: null },
    ),
  })
  .map(({ kind, junk }): ArbStorageValue => {
    const map = new Map<string, string>();
    return {
      kind,
      getItem(key: string): string | null {
        if (kind === "throws-on-read") throw new Error("fictional read failure");
        if (kind === "arbitrary") return map.get(key) ?? junk;
        return map.get(key) ?? null;
      },
      setItem(key: string, value: string): void {
        if (kind === "throws-on-write") throw new Error("fictional write failure");
        map.set(key, value);
      },
    };
  });

/** Plain Vite-style env objects. */
export const arbBuildEnv: fc.Arbitrary<{ PROD: boolean; MODE: string }> = fc.record({
  PROD: fc.boolean(),
  MODE: fc.oneof(
    fc.constantFrom("development", "production", "test"),
    fc.string({ maxLength: 12 }),
  ),
});

/** Plain DrillRecord arrays with unique ids; some records have no `founder_checked`. */
export const arbDrillList: fc.Arbitrary<DrillRecord[]> = fc
  .array(fc.tuple(arbDrill, fc.boolean()), { maxLength: 6 })
  .map((items) =>
    items.map(([drill, dropFlag], i) => {
      const withId: DrillRecord = {
        ...drill,
        def: { ...drill.def, id: `${drill.def.id}-${i}` },
      };
      if (!dropFlag) return withId;
      const { founder_checked: _omitted, ...rest } = withId;
      return rest as unknown as DrillRecord;
    }),
  );

const URL_PREFIXES = [
  "https://", "http://", "/", "ftp://", "//", "", " https://", "HTTPS://",
  "javascript:", "https:/", "mailto:",
] as const;

/** Raw switcher values: valid and invalid prefixes, lengths around 2048. */
export const arbUrl: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...URL_PREFIXES),
    fc.oneof(
      fc.string({ maxLength: 30 }),
      fc.integer({ min: 2044, max: 2052 }).map((total) => ({ total })),
    ),
  )
  .map(([prefix, body]) =>
    typeof body === "string"
      ? prefix + body
      : prefix + "a".repeat(Math.max(0, body.total - prefix.length)),
  );
