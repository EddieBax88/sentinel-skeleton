import type { CodeTrailDef } from "./types.js";

/** Typed identity function: returns the same object reference it receives. */
export function defineCodeTrail(def: CodeTrailDef): CodeTrailDef {
  return def;
}
