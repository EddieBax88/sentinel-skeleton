import type { CodeTrail, TrailLevel, TrailStep } from "./types.js";

/** Pick value a user submits at the part position to say "this trail has no part". */
export const NO_PARTS = "NONE" as const;

export type TrailVerdict = "correct" | "incorrect" | "unanswered";

export type StepResult = {
  level: TrailLevel;
  verdict: TrailVerdict;
};

export type GradeResult = {
  stepResults: StepResult[];
  matched: boolean;
  matchedMovedFrom: boolean;
};

export type DrillDef = {
  trails: readonly [CodeTrail, ...CodeTrail[]];
  movedFrom?: CodeTrail;
};

export type UserPick = {
  readonly level: TrailLevel;
  readonly value: string;
};

type Attempt = {
  stepResults: StepResult[];
  correctCount: number;
  matched: boolean;
};

const normalize = (value: string): string => value.trim().toLowerCase();

function flatten(trail: CodeTrail): TrailStep[] {
  const steps: TrailStep[] = [];
  for (const leg of trail.legs) {
    for (const step of leg) steps.push(step);
  }
  return steps;
}

function attempt(trail: CodeTrail, picks: readonly UserPick[]): Attempt {
  const steps = flatten(trail);
  const hasPart = steps.some((s) => s.level === "part");
  const effective = hasPart
    ? picks
    : picks.filter((p) => !(p.level === "part" && p.value === NO_PARTS));

  let correctCount = 0;
  const stepResults: StepResult[] = steps.map((step, i) => {
    const pick = effective[i];
    if (pick === undefined) return { level: step.level, verdict: "unanswered" };
    const ok =
      pick.level === step.level &&
      normalize(pick.value) === normalize(step.value);
    if (ok) correctCount++;
    return { level: step.level, verdict: ok ? "correct" : "incorrect" };
  });

  // Extra picks beyond the trail's steps mean the answer is not an exact match.
  const matched = correctCount === steps.length && effective.length === steps.length;
  return { stepResults, correctCount, matched };
}

export function gradeTrail(
  drill: DrillDef,
  picks: readonly UserPick[],
): GradeResult {
  let best: Attempt | undefined;
  for (const trail of drill.trails) {
    const a = attempt(trail, picks);
    if (a.matched) {
      return { stepResults: a.stepResults, matched: true, matchedMovedFrom: false };
    }
    if (best === undefined || a.correctCount > best.correctCount) best = a;
  }

  if (drill.movedFrom !== undefined) {
    const a = attempt(drill.movedFrom, picks);
    if (a.matched) {
      return { stepResults: a.stepResults, matched: false, matchedMovedFrom: true };
    }
  }

  // drill.trails is non-empty, so best is always defined here.
  return {
    stepResults: (best as Attempt).stepResults,
    matched: false,
    matchedMovedFrom: false,
  };
}
