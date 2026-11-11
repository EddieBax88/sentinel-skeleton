import type { PluginRegistry, RegistryEntry } from "./types.js";

export function createRegistry(): PluginRegistry {
  const map = new Map<string, RegistryEntry>();
  const order: RegistryEntry[] = [];

  return {
    register(entry: RegistryEntry): void {
      const id: unknown = (entry as { id?: unknown } | null | undefined)?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error("PluginRegistry: entry id must be a non-empty string");
      }
      if (map.has(id)) {
        throw new Error(`PluginRegistry: duplicate id "${id}"`);
      }
      map.set(id, entry);
      order.push(entry);
    },
    lookup(id: string): RegistryEntry | undefined {
      return map.get(id);
    },
    list(): ReadonlyArray<RegistryEntry> {
      // Return a copy so callers cannot observe later mutations or affect internal order.
      return order.slice();
    },
  };
}
