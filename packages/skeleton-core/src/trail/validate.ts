import type { CodeTrail, TrailLevel, TrailStep } from "./types.js";

/**
 * Returns the numeric value of the first contiguous run of ASCII digits
 * (0-9) in `s`, or `null` if the string contains no ASCII digit.
 * Only the first digit run is considered; later runs are ignored.
 */
export function extractFirstNumber(s: string): number | null {
  const m = s.match(/[0-9]+/);
  return m ? Number(m[0]) : null;
}

export type ValidationFailure = {
  field: string;
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; failures: ValidationFailure[] };

/**
 * Structural input accepted in addition to a plain CodeTrail. A CodeTrailDef
 * (defined in the drill layer) is assignable to this type.
 */
export type ValidatableDrill = {
  readonly trails: readonly CodeTrail[];
  readonly movedFrom?: CodeTrail;
  readonly editionNote?: string;
};

const VALID_STARTS =
  'chapter, annex, index, or article (Article 90 only)';

/** Validates one leg's step sequence; `prefix` is e.g. "legs[0]". */
function validateLeg(
  leg: readonly TrailStep[],
  prefix: string,
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const fail = (j: number, message: string) =>
    failures.push({ field: `${prefix}.steps[${j}]`, message });

  if (leg.length === 0) {
    failures.push({ field: prefix, message: "A leg must contain at least one step." });
    return failures;
  }

  const first = leg[0];
  type Kind = "main" | "ch9" | "annex" | "art90" | "index";
  let kind: Kind;
  if (first.level === "chapter") {
    const n = extractFirstNumber(first.value);
    if (n === null || n < 1 || n > 9) {
      fail(0, `Chapter step must identify a chapter from 1 to 9; got "${first.value}".`);
      return failures;
    }
    kind = n === 9 ? "ch9" : "main";
  } else if (first.level === "annex") {
    kind = "annex";
  } else if (first.level === "index") {
    kind = "index";
  } else if (first.level === "article") {
    if (extractFirstNumber(first.value) !== 90) {
      fail(0, `A leg may start with an article only for Article 90; valid starts are ${VALID_STARTS}.`);
      return failures;
    }
    kind = "art90";
  } else {
    fail(0, `Unknown first step level "${first.level}"; valid starts are ${VALID_STARTS}.`);
    return failures;
  }

  // Per-kind transitions: allowed next levels given the previous level.
  const next: Record<Kind, Partial<Record<TrailLevel, readonly TrailLevel[]>>> = {
    main: {
      chapter: ["article"],
      article: ["part", "section", "table"],
      part: ["section", "table"],
      section: ["section", "table", "notes"],
      table: ["section", "table", "notes"],
      notes: [],
    },
    ch9: { chapter: ["table"], table: ["notes"], notes: [] },
    annex: { annex: ["table"], table: ["notes"], notes: [] },
    art90: { article: ["section"], section: ["notes"], notes: [] },
    index: {
      index: ["section", "table"],
      section: ["section", "table", "notes"],
      table: ["section", "table", "notes"],
      notes: [],
    },
  };
  const endable: readonly TrailLevel[] = ["section", "table", "notes"];

  for (let j = 1; j < leg.length; j++) {
    const prev = leg[j - 1].level;
    const allowed = next[kind][prev] ?? [];
    if (!allowed.includes(leg[j].level)) {
      const expected = allowed.length ? allowed.join(" or ") : "no further steps";
      fail(
        j,
        `Step "${leg[j].level}" is not allowed after "${prev}" in a ${kind} leg; expected ${expected}.`,
      );
      return failures;
    }
  }

  const last = leg[leg.length - 1].level;
  if (!endable.includes(last)) {
    fail(
      leg.length - 1,
      `A ${kind} leg cannot end at "${last}"; it must end at section, table, or notes.`,
    );
  }
  return failures;
}

function validateTrail(trail: CodeTrail, prefix: string): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const kwField = prefix ? `${prefix}.keyword` : "keyword";
  const legsField = prefix ? `${prefix}.legs` : "legs";
  if (trail.keyword.trim() === "") {
    failures.push({ field: kwField, message: "Keyword must be a non-empty string." });
  } else if (trail.keyword.length > 200) {
    failures.push({ field: kwField, message: "Keyword must be at most 200 characters." });
  }
  if (trail.legs.length === 0) {
    failures.push({ field: legsField, message: "At least one leg is required." });
  }
  trail.legs.forEach((leg, i) => {
    failures.push(...validateLeg(leg, `${legsField}[${i}]`));
  });
  return failures;
}

/**
 * Validates a CodeTrail, or a drill definition (every trail in `trails`, the
 * optional `movedFrom`, and the optional `editionNote` length 1-300).
 * Collects all failures into one result and never mutates its input.
 */
export function validateCodeTrail(
  input: CodeTrail | ValidatableDrill,
): ValidationResult {
  const failures: ValidationFailure[] = [];
  if ("trails" in input) {
    input.trails.forEach((t, i) => failures.push(...validateTrail(t, `trails[${i}]`)));
    if (input.movedFrom !== undefined) {
      failures.push(...validateTrail(input.movedFrom, "movedFrom"));
    }
    if (input.editionNote !== undefined) {
      const len = input.editionNote.length;
      if (len < 1 || len > 300) {
        failures.push({
          field: "editionNote",
          message: "editionNote must be between 1 and 300 characters.",
        });
      }
    }
  } else {
    failures.push(...validateTrail(input, ""));
  }
  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}
