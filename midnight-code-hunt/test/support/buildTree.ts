// Test-only helper. Everything here is fictional; no real NEC content.
// Production code never imports this file.
import type { CodeTrail } from "@sentinel/skeleton-core";
import type {
  OptionNode,
  OptionRole,
  OptionTree,
} from "../../src/model/types";

/**
 * Decoy value pools. Sibling group number `g` (depth-first, root group is 0)
 * draws its wrong values from `decoys[g % decoys.length]`, at most 6 of them.
 * An empty pool adds no wrong nodes (the toc Chapter level is still filled
 * to the nine fixed options).
 */
export type DecoyPool = readonly (readonly string[])[];

const MAX_WRONG = 6;
const DECOY_PART = "Part IX"; // generated valid parts never use IX

type Level = OptionNode["level"];

type Draft = {
  level: Level;
  value: string;
  role: OptionRole;
  hasParts: boolean;
  children: Draft[];
};

const norm = (s: string): string => s.trim().toLowerCase();

function stepsOf(trail: CodeTrail): { level: Level; value: string }[] {
  const out: { level: Level; value: string }[] = [
    { level: "keyword", value: trail.keyword },
  ];
  for (const leg of trail.legs) {
    for (const s of leg) out.push({ level: s.level, value: s.value });
  }
  return out;
}

function insert(root: Draft, trail: CodeTrail, role: OptionRole): void {
  const steps = stepsOf(trail);
  let cursor = root;
  steps.forEach((step, i) => {
    let child = cursor.children.find(
      (c) => c.level === step.level && norm(c.value) === norm(step.value),
    );
    if (!child) {
      child = {
        level: step.level,
        value: step.value,
        role,
        hasParts: false,
        children: [],
      };
      cursor.children.push(child);
    }
    if (step.level === "article" && steps[i + 1]?.level === "part") {
      child.hasParts = true;
    }
    cursor = child;
  });
}

function makeNode(
  level: Level,
  value: string,
  role: OptionRole,
  hasParts: boolean,
  next: readonly OptionNode[],
): OptionNode {
  const nextProp =
    next.length > 0 ? { next: next as unknown as [OptionNode, ...OptionNode[]] } : {};
  if (level === "article") {
    return { level, value, role, hasParts, ...nextProp };
  }
  return { level, value, role, ...nextProp };
}

/**
 * Derives a consistent Option_Tree from valid trails (role `correct`) and an
 * optional 2023 `movedFrom` trail (role `moved` where it leaves the valid
 * routes), then adds up to 6 `wrong` nodes per sibling group. A wrong value
 * never equals a trail or movedFrom value at the same depth. In the toc tree,
 * a Chapter group is instead filled to the nine fixed options (Chapter 1 to
 * 9, ordered), which are exempt from the cap. Article nodes carry `hasParts`
 * true exactly when a trail steps from them to a `part`; a wrong Article with
 * `hasParts` true offers one wrong `part` node.
 */
export function treeFromTrails(
  trails: readonly CodeTrail[],
  movedFrom?: CodeTrail,
  decoys: DecoyPool = [],
  whys?: WhyPicker,
): OptionTree {
  const root: Draft = {
    level: "keyword",
    value: "",
    role: "correct",
    hasParts: false,
    children: [],
  };
  for (const t of trails) insert(root, t, "correct");
  if (movedFrom) insert(root, movedFrom, "moved");

  // Values in use per depth (0 = keyword), across every route in this tree.
  const usedAtDepth = new Map<number, Set<string>>();
  const all = movedFrom ? [...trails, movedFrom] : [...trails];
  for (const t of all) {
    stepsOf(t).forEach((s, d) => {
      const set = usedAtDepth.get(d) ?? new Set<string>();
      set.add(norm(s.value));
      usedAtDepth.set(d, set);
    });
  }

  let group = 0;
  const convertGroup = (children: readonly Draft[], depth: number): OptionNode[] => {
    const g = group++;
    const level = children[0].level;
    const siblings = new Set(children.map((c) => norm(c.value)));

    // Convert real children first so group numbers follow depth-first order.
    const nodes: OptionNode[] = children.map((c) =>
      makeNode(
        c.level,
        c.value,
        c.role,
        c.hasParts,
        c.children.length > 0 ? convertGroup(c.children, depth + 1) : [],
      ),
    );

    if (level === "chapter") {
      for (let n = 1; n <= 9; n++) {
        const value = `Chapter ${n}`;
        if (siblings.has(norm(value))) continue;
        nodes.push(makeNode("chapter", value, "wrong", false, []));
      }
      return nodes.sort(
        (a, b) =>
          Number(/[0-9]+/.exec(a.value)?.[0] ?? 0) -
          Number(/[0-9]+/.exec(b.value)?.[0] ?? 0),
      );
    }

    const pool = decoys.length > 0 ? decoys[g % decoys.length] : [];
    const taken = new Set<string>([...siblings, ...(usedAtDepth.get(depth) ?? [])]);
    let added = 0;
    for (const raw of pool) {
      if (added >= MAX_WRONG) break;
      const key = norm(raw);
      if (key === "" || key === "none" || raw.length > 200 || taken.has(key)) continue;
      taken.add(key);
      added++;
      if (level === "article") {
        const hasParts = raw.length % 2 === 0;
        const next = hasParts ? [makeNode("part", DECOY_PART, "wrong", false, [])] : [];
        nodes.push(makeNode("article", raw, "wrong", hasParts, next));
      } else {
        nodes.push(makeNode(level, raw, "wrong", false, []));
      }
    }

    const shift = nodes.length > 1 ? g % nodes.length : 0;
    return [...nodes.slice(shift), ...nodes.slice(0, shift)];
  };

  const tree = convertGroup(root.children, 0) as unknown as OptionTree;
  return whys ? addWhys(tree, whys) : tree;
}

/**
 * Picks the Why_Sentence for the `index`-th `correct` node (depth-first,
 * Keyword nodes included). Return `undefined` to leave the node without one.
 */
export type WhyPicker = (index: number, node: OptionNode) => string | undefined;

/** Returns a copy of `tree` where `correct` nodes carry the `why` that `pick` gives. */
export function addWhys(tree: OptionTree, pick: WhyPicker): OptionTree {
  let i = 0;
  const walk = (nodes: readonly OptionNode[]): OptionNode[] =>
    nodes.map((n) => {
      const why = n.role === "correct" ? pick(i++, n) : undefined;
      const next = n.next ? { next: walk(n.next) as unknown as [OptionNode, ...OptionNode[]] } : {};
      const { next: _old, ...rest } = n as OptionNode & { next?: unknown };
      return { ...rest, ...(why !== undefined ? { why } : {}), ...next } as OptionNode;
    });
  return walk(tree) as unknown as OptionTree;
}

/** Returns a copy of `tree` where the first node matching `match` gets `why` (any role). */
export function setWhyOn(
  tree: OptionTree,
  match: (n: OptionNode) => boolean,
  why: string,
): OptionTree | undefined {
  let done = false;
  const walk = (nodes: readonly OptionNode[]): OptionNode[] =>
    nodes.map((n) => {
      const hit = !done && match(n);
      if (hit) done = true;
      const next = n.next ? { next: walk(n.next) as unknown as [OptionNode, ...OptionNode[]] } : {};
      const { next: _old, ...rest } = n as OptionNode & { next?: unknown };
      return { ...rest, ...(hit ? { why } : {}), ...next } as OptionNode;
    });
  const out = walk(tree) as unknown as OptionTree;
  return done ? out : undefined;
}
