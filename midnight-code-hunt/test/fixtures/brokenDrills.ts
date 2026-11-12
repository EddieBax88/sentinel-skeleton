// FICTIONAL FIXTURES. Not real NEC content.
// One deliberately broken drill per validateDrillData rule code, each built by
// minimally mutating a drill from fixtureDrills.ts. Test-only.
import type { DrillRecord, OptionNode, OptionTree } from "../../src/model/types";
import type { CheckedNamesFile } from "../../src/logic/displayName";
import {
  articleNoPartsDrill,
  movedArticleDrill,
} from "./fixtureDrills";
import {
  CLEAN_NAMES,
  FICTIONAL_NAMES,
  KEY_INCONSISTENT,
  KEY_MISSING,
  fictionalNames2023,
} from "./fictionalNames";

export type NamesPair = { readonly y2023: CheckedNamesFile; readonly y2026: CheckedNamesFile };

export type BrokenCase = {
  /** Rule code the validator must report. */
  readonly rule: string;
  /** Drill id the issue must name; "names:2023" or "names:2026" for names-file rules. */
  readonly drillId: string;
  readonly description: string;
  readonly drills: readonly DrillRecord[];
  readonly names: NamesPair;
};

type Group = readonly OptionNode[];

/** Returns a copy of the tree with the group reached by `path` (node values from the root) replaced. */
function editGroup(tree: OptionTree, path: readonly string[], fn: (g: Group) => Group): OptionTree {
  const go = (group: Group, depth: number): Group => {
    if (depth === path.length) return fn(group);
    return group.map((n) =>
      n.value === path[depth] && n.next !== undefined
        ? ({ ...n, next: go(n.next, depth + 1) } as OptionNode)
        : n,
    );
  };
  return go(tree, 0) as unknown as OptionTree;
}

/** Returns a copy of the tree with the node reached by `path` (last value is the node) replaced. */
function editNode(tree: OptionTree, path: readonly string[], fn: (n: OptionNode) => OptionNode): OptionTree {
  return editGroup(tree, path.slice(0, -1), (g) =>
    g.map((n) => (n.value === path[path.length - 1] ? fn(n) : n)),
  );
}

const withToc = (d: DrillRecord, toc: OptionTree): DrillRecord => ({ ...d, trees: { ...d.trees, toc } });

const noParts = articleNoPartsDrill; // keyword > Chapter 3 > Article 377 > 377.20
const NP_ARTICLE = ["Fictional widget spacing", "Chapter 3", "Article 377"] as const;
const NP_SECTION = [...NP_ARTICLE, "377.20"] as const;
const noPartsToc = noParts.trees.toc;
const id = (d: DrillRecord): string => d.def.id;

const wrongSection = (value: string): OptionNode => ({ level: "section", value, role: "wrong" });

const make = (rule: string, d: DrillRecord, description: string, names: NamesPair = CLEAN_NAMES): BrokenCase => ({
  rule,
  drillId: id(d),
  description,
  drills: [d],
  names,
});

const namesCase = (rule: string, edition: 2023 | 2026, description: string, file: CheckedNamesFile): BrokenCase => ({
  rule,
  drillId: `names:${edition}`,
  description,
  drills: [],
  names: edition === 2023 ? { y2023: file, y2026: CLEAN_NAMES.y2026 } : { y2023: CLEAN_NAMES.y2023, y2026: file },
});

export const BROKEN_CASES: readonly BrokenCase[] = [
  make("R2.11", { ...noParts, wrongOptionsReviewed: false }, "founder_checked true with wrongOptionsReviewed false"),
  make("R6.4", { ...noParts, index_checked: true }, "index_checked true with no Index tree"),
  make(
    "R17.2",
    { ...noParts, def: { ...noParts.def, editionNote: "" } },
    "editionNote is empty, which the Core rejects",
  ),
  make(
    "R17.4",
    { ...noParts, def: { ...noParts.def, trails: [] as unknown as typeof noParts.def.trails } },
    "no toc trail is declared",
  ),
  make(
    "R17.6",
    { ...movedArticleDrill, def: { ...movedArticleDrill.def, movedFrom: movedArticleDrill.def.trails[0] } },
    "movedFrom equals a valid trail, so it grades matched",
  ),
  make("R2.14", { ...noParts, question: "   " }, "question is whitespace only"),
  {
    rule: "R2.13",
    drillId: id(noParts),
    description: "two records share one id",
    drills: [noParts, noParts],
    names: CLEAN_NAMES,
  },
  make(
    "R2.12",
    withToc(noParts, editGroup(noPartsToc, NP_ARTICLE, (g) => [...g, wrongSection("377.20")])),
    "a wrong section repeats the correct sibling value",
  ),
  make(
    "R2.5",
    withToc(
      noParts,
      editGroup(noPartsToc, NP_ARTICLE, (g) => [
        ...g,
        ...[1, 2, 3, 4, 5, 6, 7].map((n) => wrongSection(`377.${n}0${n}`)),
      ]),
    ),
    "seven wrong options in one non-Chapter level",
  ),
  make(
    "R-chapter",
    withToc(
      noParts,
      editNode(noPartsToc, ["Fictional widget spacing", "Chapter 1"], (n) => ({ ...n, value: "Chapter 10" })),
    ),
    "a Chapter option identifies chapter 10",
  ),
  make(
    "R-value",
    withToc(noParts, editGroup(noPartsToc, NP_ARTICLE, (g) => [...g, wrongSection("")])),
    "a node value is empty",
  ),
  make(
    "R-none",
    withToc(noParts, editGroup(noPartsToc, NP_ARTICLE, (g) => [...g, wrongSection("None")])),
    'a node value normalizes to "none"',
  ),
  make(
    "R17.9-moved",
    withToc(noParts, editNode(noPartsToc, NP_SECTION, (n) => ({ ...n, role: "moved" }))),
    "a route holds a moved node but the drill has no movedFrom",
  ),
  make(
    "R17.9-hasParts",
    withToc(
      noParts,
      editNode(noPartsToc, NP_ARTICLE, (n) => ({ ...n, hasParts: true }) as OptionNode),
    ),
    "a part-less Article is marked hasParts",
  ),
  make(
    "R17.9-end",
    withToc(
      noParts,
      editNode(noPartsToc, NP_SECTION, (n) => ({ ...n, next: [] }) as unknown as OptionNode),
    ),
    "a node's next level is an empty list",
  ),
  make(
    "R17.9-reach",
    withToc(noParts, editNode(noPartsToc, NP_SECTION, (n) => ({ ...n, value: "377.21" }))),
    "the declared trail's section is absent from the tree",
  ),
  make(
    "R17.9-phantom",
    withToc(
      noParts,
      editGroup(noPartsToc, NP_ARTICLE, (g) => [...g, { level: "section", value: "377.99", role: "correct" }]),
    ),
    "an all-correct route matches no declared trail",
  ),
  make(
    "R3.8",
    withToc(
      noParts,
      editNode(noPartsToc, NP_ARTICLE, (n) => ({ ...n, nameKey: KEY_MISSING }) as OptionNode),
    ),
    "a node's nameKey has no entry in the names file",
    FICTIONAL_NAMES,
  ),
  make(
    "R3.4",
    withToc(
      noParts,
      editNode(noPartsToc, NP_ARTICLE, (n) => ({ ...n, nameKey: KEY_INCONSISTENT }) as OptionNode),
    ),
    "a node resolves to a checked entry with no printed wording",
    FICTIONAL_NAMES,
  ),
  namesCase(
    "R3.4",
    2023,
    "a names entry is checked but has no printed wording",
    { edition: 2023, entries: [{ key: KEY_INCONSISTENT, shortDescription: "made-up doohickey rules", checked: true }] },
  ),
  namesCase(
    "R3.1",
    2026,
    "the 2026 names file holds edition 2023",
    { ...fictionalNames2023, entries: [] } as unknown as CheckedNamesFile,
  ),
  namesCase(
    "R3.6",
    2023,
    "a short description uses uppercase letters",
    { edition: 2023, entries: [{ key: "fictional-bad-description", shortDescription: "Made-Up Title Case", checked: false }] },
  ),
];
