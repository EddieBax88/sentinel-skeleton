import type { DrillRecord } from "../model/types";

export type BuildMode = "production" | "development" | "test";
export type DrillEntry = { readonly drill: DrillRecord; readonly draft: boolean };

/** Maps Vite env to a BuildMode. PROD wins, so a custom --mode cannot publish drafts. */
export function getBuildMode(env: { PROD: boolean; MODE: string }): BuildMode {
  if (env.PROD === true) return "production";
  if (env.MODE === "test") return "test";
  if (env.MODE === "production") return "production";
  return "development";
}

function isChecked(drill: DrillRecord): boolean {
  return drill.founder_checked === true;
}

/** Pure. Returns a new array; never mutates input or its records. */
export function filterDrills(
  drills: readonly DrillRecord[],
  mode: BuildMode,
): DrillEntry[] {
  if (mode === "production") {
    return drills.filter(isChecked).map((drill) => ({ drill, draft: false }));
  }
  return drills.map((drill) => ({ drill, draft: !isChecked(drill) }));
}
