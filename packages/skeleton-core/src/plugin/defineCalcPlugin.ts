import type { CalcPluginDef } from "./types.js";

/** Typed identity function: returns the same object reference it receives. */
export function defineCalcPlugin<I, O>(
  def: CalcPluginDef<I, O>
): CalcPluginDef<I, O> {
  return def;
}
