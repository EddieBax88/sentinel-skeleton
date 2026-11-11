export type TrailLevel =
  | "chapter"
  | "article"
  | "part"
  | "section"
  | "table"
  | "notes"
  | "annex"
  | "index";

export const ALLOWED_LEVELS = [
  "chapter",
  "article",
  "part",
  "section",
  "table",
  "notes",
  "annex",
  "index",
] as const satisfies readonly TrailLevel[];

export type TrailStep = {
  readonly level: TrailLevel;
  readonly value: string; // 1–200 characters, non-empty
};

export type TrailLeg = readonly [TrailStep, ...TrailStep[]]; // non-empty

export type CodeTrail = {
  readonly keyword: string; // 1–200 characters, non-empty
  readonly legs: readonly [TrailLeg, ...TrailLeg[]]; // non-empty
};
