// Pure drill-data validator. Used only by tests; no app code imports this file.
// Pure and total: it returns every issue it finds and never throws.
import { extractFirstNumber, gradeTrail, validateCodeTrail } from "@sentinel/skeleton-core";
import type { CodeTrail, DrillDef, UserPick } from "@sentinel/skeleton-core";
import { methodOf } from "../model/methods";
import type { DrillRecord, MethodId, OptionNode } from "../model/types";
import { buildNamesIndex, editionOf, resolveDisplay } from "../logic/displayName";
import type { CheckedNamesFile } from "../logic/displayName";

export type DataIssue = {
  /** The drill `id`; for names-file issues, "names:2023" or "names:2026". */
  readonly drillId: string;
  /** Rule code, e.g. "R2.11", "R3.8", "R17.9-hasParts". */
  readonly rule: string;
  readonly message: string;
  /** Offending field, e.g. "question", "trails[1]", "trees.toc". */
  readonly field?: string;
  /** Depth of the offending step (0 = Keyword), when the issue is about a tree position. */
  readonly step?: number;
  /** Values from the Keyword node down to the offending node, joined with " > ". */
  readonly path?: string;
  /** The unresolved or offending checked-names key, when relevant. */
  readonly key?: string;
};

type NamesFiles = {
  readonly y2023: CheckedNamesFile;
  readonly y2026: CheckedNamesFile;
};

const MAX_WRONG = 6;
const MAX_DEPTH = 64;
const MAX_ROUTES = 50_000;
const SHORT_DESCRIPTION = /^[a-z0-9 ,-]{1,80}$/;

const norm = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const trimmedLength = (value: unknown): number =>
  typeof value === "string" ? value.trim().length : 0;

// The one-sentence test shared by the fork sentences and the Why_Sentences:
// true when the trimmed text holds a sentence end followed by more text.
const isMultiSentence = (value: string): boolean => /[.!?]["')\]]*\s+\S/.test(value.trim());

type Step = { readonly level: string; readonly value: string };

function flatten(trail: CodeTrail): Step[] {
  const steps: Step[] = [{ level: "keyword", value: trail.keyword }];
  for (const leg of trail.legs) for (const s of leg) steps.push({ level: s.level, value: s.value });
  return steps;
}

const sameSteps = (a: readonly Step[], b: readonly Step[]): boolean =>
  a.length === b.length &&
  a.every((s, i) => s.level === (b[i] as Step).level && norm(s.value) === norm((b[i] as Step).value));

const toPicks = (trail: CodeTrail): UserPick[] =>
  trail.legs.flatMap((leg) => leg.map((s) => ({ level: s.level, value: s.value })));

const pathText = (nodes: readonly OptionNode[]): string => nodes.map((n) => String(n.value)).join(" > ");

type Route = { readonly nodes: readonly OptionNode[] };

export function validateDrillData(
  drills: readonly DrillRecord[],
  names: NamesFiles,
): DataIssue[] {
  const issues: DataIssue[] = [];
  try {
    const list: readonly DrillRecord[] = Array.isArray(drills) ? drills : [];
    const seen = new Set<string>();
    list.forEach((drill) => {
      const id = readId(drill);
      if (seen.has(id)) {
        issues.push({
          drillId: id,
          rule: "R2.13",
          field: "id",
          message: `Two drill records share the id "${id}".`,
        });
      }
      seen.add(id);
      validateOne(drill, id, names, issues);
    });
  } catch (error) {
    issues.push({ drillId: "", rule: "INTERNAL", message: describe(error) });
  }
  try {
    validateNamesFiles(names, issues);
  } catch (error) {
    issues.push({ drillId: "", rule: "INTERNAL", message: describe(error) });
  }
  return issues;
}

function describe(error: unknown): string {
  return `Validator could not finish a check: ${error instanceof Error ? error.message : String(error)}`;
}

function readId(drill: DrillRecord): string {
  const id = (drill as { def?: { id?: unknown } } | undefined)?.def?.id;
  return typeof id === "string" ? id : "";
}

function validateOne(
  drill: DrillRecord,
  id: string,
  names: NamesFiles,
  issues: DataIssue[],
): void {
  const guard = (check: () => void): void => {
    try {
      check();
    } catch (error) {
      issues.push({ drillId: id, rule: "INTERNAL", message: describe(error) });
    }
  };
  const add = (issue: Omit<DataIssue, "drillId">): void => {
    issues.push({ drillId: id, ...issue });
  };

  guard(() => checkText(drill, add));
  guard(() => checkFlags(drill, add));
  guard(() => checkCore(drill, add));
  guard(() => checkGrading(drill, add));
  guard(() => checkTrees(drill, names, add));
  guard(() => checkWhy(drill, add));
}

// R20.2, R20.4: walk both trees; a drill with no `why` anywhere yields nothing.
function checkWhy(drill: DrillRecord, add: Add): void {
  const methods: readonly MethodId[] = ["toc", "index"];
  for (const method of methods) {
    const field = `trees.${method}.why`;
    const walk = (group: readonly OptionNode[] | undefined, parents: readonly OptionNode[]): void => {
      if (!Array.isArray(group) || parents.length > MAX_DEPTH) return;
      for (const node of group) {
        const here = [...parents, node];
        const why = (node as { why?: unknown }).why;
        if (why !== undefined) {
          const place = { field, step: here.length - 1, path: pathText(here) };
          const shown = typeof why === "string" ? why : String(why);
          const length = trimmedLength(why);
          if (typeof why !== "string" || length < 1 || length > 300) {
            add({
              rule: "R20.2-length",
              ...place,
              message: `The why on node "${node.value}" must be a string of 1 to 300 characters after trimming; value: "${shown}".`,
            });
          }
          if (typeof why === "string" && isMultiSentence(why)) {
            add({
              rule: "R20.2-sentence",
              ...place,
              message: `The why on node "${node.value}" must hold exactly one sentence; value: "${shown}".`,
            });
          }
          if (node.role !== "correct") {
            add({
              rule: "R20.4-role",
              ...place,
              message: `Only a correct node may carry a why; node "${node.value}" has role ${String(node.role)}.`,
            });
          }
        }
        walk(node.next, here);
      }
    };
    walk(drill.trees?.[method], []);
  }
}

type Add = (issue: Omit<DataIssue, "drillId">) => void;

// R2.14, R2.3, R2.4, R2.15
function checkText(drill: DrillRecord, add: Add): void {
  const limit = (field: string, value: unknown, max: number): void => {
    if (typeof value !== "string" || trimmedLength(value) < 1) {
      add({ rule: "R2.14", field, message: `${field} must not be empty or whitespace only.` });
    } else if (trimmedLength(value) > max) {
      add({ rule: "R2.14", field, message: `${field} must be at most ${max} characters after trimming.` });
    }
  };
  limit("question", drill.question, 500);
  limit("answer", drill.answer, 500);
  limit("citation", drill.citation, 200);

  const sentence = (field: string, value: string | undefined): void => {
    if (value === undefined) return;
    limit(field, value, 300);
    if (typeof value === "string" && isMultiSentence(value)) {
      add({ rule: "R2.14", field, message: `${field} must hold exactly one sentence.` });
    }
  };
  sentence("chapterForkSentence", drill.chapterForkSentence);
  sentence("articleForkSentence", drill.articleForkSentence);

  const walk = drill.tableWalk;
  if (walk !== undefined) {
    limit("tableWalk.column", walk.column, 100);
    limit("tableWalk.row", walk.row, 100);
    limit("tableWalk.value", walk.value, 100);
  }
}

// R2.11, R6.4
function checkFlags(drill: DrillRecord, add: Add): void {
  if (drill.founder_checked === true && drill.wrongOptionsReviewed === false) {
    add({
      rule: "R2.11",
      field: "wrongOptionsReviewed",
      message: "A founder-checked drill must have wrongOptionsReviewed set to true.",
    });
  }
  const hasIndexTree = drill.trees?.index !== undefined;
  if (hasIndexTree !== (drill.index_checked === true)) {
    add({
      rule: "R6.4",
      field: "trees.index",
      message: "trees.index must be present exactly when index_checked is true.",
    });
  }
  if (drill.index_checked !== true && drill.def.trails.some((t) => methodOf(t) === "index")) {
    add({
      rule: "R6.4",
      field: "trails",
      message: "A drill with index_checked false must declare no Index trail.",
    });
  }
}

// R17.2
function checkCore(drill: DrillRecord, add: Add): void {
  const result = validateCodeTrail(drill.def);
  if (!result.ok) {
    for (const failure of result.failures) {
      add({ rule: "R17.2", field: failure.field, message: failure.message });
    }
  }
}

// R17.4, R17.6
function checkGrading(drill: DrillRecord, add: Add): void {
  const trails = drill.def.trails;
  trails.forEach((trail, index) => {
    const method = methodOf(trail);
    const same = trails.filter(
      (t) => methodOf(t) === method && norm(t.keyword) === norm(trail.keyword),
    );
    const def = { trails: same } as unknown as DrillDef;
    const grade = gradeTrail(def, toPicks(trail));
    if (!grade.matched) {
      add({
        rule: "R17.4",
        field: `trails[${index}]`,
        message: `Trail ${index} does not grade matched against its own method's trails.`,
      });
    }
  });
  for (const method of ["toc", "index"] as const) {
    const needed = method === "toc" || drill.trees?.index !== undefined;
    if (needed && !trails.some((t) => methodOf(t) === method)) {
      add({
        rule: "R17.4",
        field: "trails",
        message: `The ${method} method has no declared trail.`,
      });
    }
  }

  const moved = drill.def.movedFrom;
  if (moved === undefined) return;
  if (methodOf(moved) !== "toc") {
    add({
      rule: "R17.6",
      field: "movedFrom",
      message: "movedFrom must be a Table of Contents Lookup trail.",
    });
    return;
  }
  const toc = trails.filter((t) => methodOf(t) === "toc");
  const sameKeyword = toc.filter((t) => norm(t.keyword) === norm(moved.keyword));
  const pool = sameKeyword.length > 0 ? sameKeyword : toc;
  if (pool.length === 0) return; // reported above as a missing toc trail
  const grade = gradeTrail({ trails: pool, movedFrom: moved } as unknown as DrillDef, toPicks(moved));
  if (grade.matched || !grade.matchedMovedFrom) {
    add({
      rule: "R17.6",
      field: "movedFrom",
      message: "movedFrom picks must grade matched false and matchedMovedFrom true.",
    });
  }
}

function checkTrees(drill: DrillRecord, names: NamesFiles, add: Add): void {
  const index = buildNamesIndex(names);
  const methods: readonly MethodId[] = ["toc", "index"];
  for (const method of methods) {
    const tree = drill.trees?.[method];
    if (tree === undefined) {
      // A missing toc tree is a hard failure; a missing index tree is covered by R6.4.
      if (method === "toc") {
        add({ rule: "R17.9-reach", field: "trees.toc", message: "The toc tree is missing." });
      } else if (drill.def.trails.some((t) => methodOf(t) === "index")) {
        add({
          rule: "R17.9-reach",
          field: "trees.index",
          message: "An Index trail is declared but the Index tree is missing.",
        });
      }
      continue;
    }
    const field = `trees.${method}`;
    const trails = drill.def.trails.filter((t) => methodOf(t) === method);
    const moved = method === "toc" ? drill.def.movedFrom : undefined;
    checkOneTree(tree, field, method, trails, moved, index, add);
  }
}

type NamesIndex = ReturnType<typeof buildNamesIndex>;

function checkOneTree(
  tree: readonly OptionNode[],
  field: string,
  method: MethodId,
  trails: readonly CodeTrail[],
  moved: CodeTrail | undefined,
  namesIndex: NamesIndex,
  add: Add,
): void {
  const trailSteps = trails.map(flatten);
  const movedSteps = moved === undefined ? undefined : flatten(moved);

  // R2.12: a wrong option may not equal the value a valid or movedFrom trail has at the same
  // step, judged among the trails that share the route taken so far (a wrong Chapter under
  // another keyword's route is a legitimate decoy).
  const allSteps = [...trailSteps, ...(movedSteps ? [movedSteps] : [])];
  const equalsValidStep = (here: readonly OptionNode[], depth: number): boolean => {
    const node = here[depth] as OptionNode;
    return allSteps.some((steps) => {
      const step = steps[depth];
      if (step === undefined || step.level !== node.level || norm(step.value) !== norm(node.value)) {
        return false;
      }
      return here.slice(0, depth).every((p, i) => {
        const s = steps[i] as Step;
        return s.level === p.level && norm(s.value) === norm(p.value);
      });
    });
  };

  const routes: Route[] = [];
  let truncated = false;

  const at = (nodes: readonly OptionNode[], depth: number) => ({
    field,
    step: depth,
    path: pathText(nodes),
  });

  const visitGroup = (
    group: readonly OptionNode[] | undefined,
    depth: number,
    parents: readonly OptionNode[],
  ): void => {
    if (!Array.isArray(group) || group.length === 0) {
      add({
        rule: "R17.9-end",
        ...at(parents, depth),
        message:
          depth === 0
            ? "The Keyword level must hold at least one option."
            : "A node's next level must not be an empty list.",
      });
      return;
    }
    if (depth > MAX_DEPTH) {
      add({ rule: "R17.9-end", ...at(parents, depth), message: "The tree is deeper than expected." });
      return;
    }
    const level = (group[0] as OptionNode).level;

    // One level per sibling group; Keyword level only at the root.
    if (group.some((n) => n.level !== level)) {
      add({
        rule: "R17.9-end",
        ...at(parents, depth),
        message: "Siblings in one group must share one level.",
      });
    }
    if ((depth === 0) !== (level === "keyword")) {
      add({
        rule: "R17.9-end",
        ...at(parents, depth),
        message: depth === 0 ? "Root options must have level keyword." : "Only root options may have level keyword.",
      });
    }

    // R2.12: unique normalized sibling values.
    const values = new Set<string>();
    for (const node of group) {
      const key = norm(node.value);
      if (values.has(key)) {
        add({
          rule: "R2.12",
          ...at([...parents, node], depth),
          message: `Two siblings share the value "${node.value}" after trimming and lowercasing.`,
        });
      }
      values.add(key);
    }

    // R2.5 and chapter rules.
    const wrongCount = group.filter((n) => n.role === "wrong").length;
    const tocChapter = method === "toc" && level === "chapter";
    if (tocChapter) {
      const numbers = new Set<number>();
      for (const node of group) {
        const n = extractFirstNumber(String(node.value));
        if (n === null || n < 1 || n > 9) {
          add({
            rule: "R-chapter",
            ...at([...parents, node], depth),
            message: `Chapter option "${node.value}" must identify a chapter from 1 to 9.`,
          });
        } else if (numbers.has(n)) {
          add({
            rule: "R-chapter",
            ...at([...parents, node], depth),
            message: `Chapter ${n} appears more than once.`,
          });
        } else {
          numbers.add(n);
        }
      }
      for (let n = 1; n <= 9; n++) {
        if (!numbers.has(n)) {
          add({
            rule: "R2.5",
            ...at(parents, depth),
            message: `The Chapter level must hold the nine fixed options; Chapter ${n} is missing.`,
          });
        }
      }
    } else if (wrongCount > MAX_WRONG) {
      add({
        rule: "R2.5",
        ...at(parents, depth),
        message: `A level may hold at most ${MAX_WRONG} wrong options; found ${wrongCount}.`,
      });
    }

    for (const node of group) {
      const here = [...parents, node];
      checkNode(node, here, depth);
      if (routes.length >= MAX_ROUTES) {
        truncated = true;
        continue;
      }
      if (node.next === undefined) {
        routes.push({ nodes: here });
      } else {
        visitGroup(node.next, depth + 1, here);
      }
    }
  };

  const checkNode = (node: OptionNode, here: readonly OptionNode[], depth: number): void => {
    const place = at(here, depth);
    const text = typeof node.value === "string" ? node.value : "";
    if (text.trim() === "" || text.length > 200) {
      add({ rule: "R-value", ...place, message: "A node value must be 1 to 200 characters." });
    }
    if (norm(text) === "none") {
      add({
        rule: "R-none",
        ...place,
        message: 'No node value may normalize to "none"; it would collide with NO_PARTS.',
      });
    }
    if (method === "index" && node.role === "moved") {
      add({
        rule: "R17.9-moved",
        ...place,
        message: "The Index tree must hold no moved node.",
      });
    }
    if (node.role === "wrong" && equalsValidStep(here, depth)) {
      add({
        rule: "R2.12",
        ...place,
        message: `Wrong option "${node.value}" equals a valid or movedFrom value at the same step.`,
      });
    }
    if (node.level === "article") {
      const marker = (node as { hasParts?: unknown }).hasParts;
      if (typeof marker !== "boolean") {
        add({
          rule: "R17.9-hasParts",
          ...place,
          message: `Article option "${node.value}" has no has-Parts marker.`,
        });
      } else {
        const leadsToPart = node.next !== undefined && node.next[0]?.level === "part";
        if (marker !== leadsToPart) {
          add({
            rule: "R17.9-hasParts",
            ...place,
            message: marker
              ? `Article option "${node.value}" is marked hasParts but does not lead to a Part level.`
              : `Article option "${node.value}" leads to a Part level but is not marked hasParts.`,
          });
        }
      }
    }
    if (node.nameKey !== undefined) {
      const resolution = resolveDisplay(node, namesIndex);
      const edition = editionOf(node);
      if (resolution.unresolvedKey !== undefined) {
        add({
          rule: "R3.8",
          ...place,
          key: node.nameKey,
          message: `Names key "${node.nameKey}" has no entry in the ${edition} names file.`,
        });
      } else if (resolution.inconsistent === true) {
        add({
          rule: "R3.4",
          ...place,
          key: node.nameKey,
          message: `Names entry "${node.nameKey}" (${edition}) is checked but has no printed wording.`,
        });
      }
    }
  };

  visitGroup(tree, 0, []);
  if (truncated) {
    add({ rule: "R17.9-end", field, message: "The tree has too many routes to check in full." });
  }

  // Phantom and moved routes.
  for (const route of routes) {
    const steps: Step[] = route.nodes.map((n) => ({ level: n.level, value: n.value }));
    const allCorrect = route.nodes.every((n) => n.role === "correct");
    // Routes through a wrong node are decoy routes, even below a moved node.
    const hasMoved =
      route.nodes.some((n) => n.role === "moved") && route.nodes.every((n) => n.role !== "wrong");
    const place = at(route.nodes, route.nodes.length - 1);
    if (allCorrect && !trailSteps.some((t) => sameSteps(t, steps))) {
      add({
        rule: "R17.9-phantom",
        ...place,
        message: "An all-correct route does not equal any declared trail of this method.",
      });
    }
    if (hasMoved && !(movedSteps !== undefined && sameSteps(movedSteps, steps))) {
      add({
        rule: "R17.9-moved",
        ...place,
        message: "A route with a moved node must equal movedFrom.",
      });
    }
  }

  // Reachability and has-Parts agreement for each declared trail.
  const reach = (steps: readonly Step[], label: string, allowMoved: boolean, index: number): void => {
    let options: readonly OptionNode[] | undefined = tree;
    const walked: OptionNode[] = [];
    for (let depth = 0; depth < steps.length; depth++) {
      const step = steps[depth] as Step;
      const node: OptionNode | undefined = options?.find(
        (o) =>
          o.level === step.level &&
          norm(o.value) === norm(step.value) &&
          (o.role === "correct" || (allowMoved && o.role === "moved")),
      );
      if (node === undefined) {
        add({
          rule: "R17.9-reach",
          field,
          step: depth,
          path: pathText(walked),
          message: `${label} (${index}) is not reachable: no ${allowMoved ? "correct or moved" : "correct"} ${step.level} option "${step.value}" at this step.`,
        });
        return;
      }
      walked.push(node);
      if (node.level === "article" && typeof node.hasParts === "boolean") {
        const expected = steps[depth + 1]?.level === "part";
        if (node.hasParts !== expected) {
          add({
            rule: "R17.9-hasParts",
            field,
            step: depth,
            path: pathText(walked),
            message: `Article option "${node.value}" marker does not match the trail (${expected ? "has" : "has no"} Part step).`,
          });
        }
      }
      options = node.next;
    }
    if (options !== undefined) {
      add({
        rule: "R17.9-end",
        field,
        step: steps.length - 1,
        path: pathText(walked),
        message: `${label} (${index}) ends at an option that still has a next level.`,
      });
    }
  };
  trailSteps.forEach((steps, i) => reach(steps, "Trail", false, i));
  if (movedSteps !== undefined) reach(movedSteps, "movedFrom", true, 0);
}

// R3.1, R3.4, R3.6
function validateNamesFiles(names: NamesFiles, issues: DataIssue[]): void {
  const files: readonly (readonly [CheckedNamesFile | undefined, 2023 | 2026])[] = [
    [names?.y2023, 2023],
    [names?.y2026, 2026],
  ];
  for (const [file, edition] of files) {
    const drillId = `names:${edition}`;
    if (file === undefined) continue;
    if (file.edition !== edition) {
      issues.push({ drillId, rule: "R3.1", message: `The names file holds edition ${file.edition}, expected ${edition}.` });
    }
    const keys = new Set<string>();
    for (const entry of Array.isArray(file.entries) ? file.entries : []) {
      const key = typeof entry.key === "string" ? entry.key : "";
      const issue = (rule: string, message: string): void => {
        issues.push({ drillId, rule, key, message });
      };
      if (key.length < 1 || key.length > 80) issue("R3.1", `Key "${key}" must be 1 to 80 characters.`);
      if (keys.has(key)) issue("R3.1", `Key "${key}" appears more than once.`);
      keys.add(key);
      if (typeof entry.shortDescription !== "string" || !SHORT_DESCRIPTION.test(entry.shortDescription)) {
        issue("R3.6", `Short description for "${key}" must be 1 to 80 characters of a-z, 0-9, space, comma, hyphen.`);
      }
      if (entry.printed !== undefined && (entry.printed.length < 1 || entry.printed.length > 200)) {
        issue("R3.1", `Printed wording for "${key}" must be 1 to 200 characters.`);
      }
      if (entry.checked === true && entry.printed === undefined) {
        issue("R3.4", `Entry "${key}" is checked but has no printed wording.`);
      }
    }
  }
}
