import type { CalcPlugin } from "../plugin/types.js";
import type { CodeTrailDef } from "../drill/types.js";

export type RegistryEntry = CalcPlugin | CodeTrailDef;

export interface PluginRegistry {
  register(entry: RegistryEntry): void;
  lookup(id: string): RegistryEntry | undefined;
  list(): ReadonlyArray<RegistryEntry>;
}
