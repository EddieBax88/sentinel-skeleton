// Best times kept on the user's own device only (Req 12.1, 12.2).
// One storage item per drill-and-method pair; each value is the elapsed
// seconds written with JSON.stringify, so a corrupt item affects only its pair.

/** Local stand-in for the model's MethodId union. */
type MethodId = "index" | "toc";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function bestKey(drillId: string, method: MethodId): string {
  return `mch.best.v1:${method}:${drillId}`;
}

/** Req 12.6. prev undefined -> elapsed; otherwise Math.min(prev, elapsed). */
export function updateBest(prev: number | undefined, elapsed: number): number {
  return prev === undefined ? elapsed : Math.min(prev, elapsed);
}

/** Req 12.9. Accepts only JSON that parses to a finite number >= 0; otherwise undefined. */
export function parseStoredSeconds(raw: string | null): number | undefined {
  if (typeof raw !== "string") return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export type SubmitOutcome = { readonly best: number; readonly isNewBest: boolean };

export interface BestTimesStore {
  get(drillId: string, method: MethodId): number | undefined;
  /** Saves only when no best exists or elapsed < best. Never throws. */
  submit(drillId: string, method: MethodId, elapsedSeconds: number): SubmitOutcome;
  /** False after any read or write threw, or when storage was not provided (Req 12.8). */
  readonly persistent: boolean;
}

/** `storage` undefined (or a throwing storage) -> in-memory only. */
export function createBestTimesStore(storage: StorageLike | undefined): BestTimesStore {
  const shadow = new Map<string, number>();
  let persistent = storage !== undefined && storage !== null;

  function read(key: string): number | undefined {
    if (persistent && storage) {
      try {
        const parsed = parseStoredSeconds(storage.getItem(key));
        if (parsed !== undefined) return parsed;
      } catch {
        persistent = false;
      }
    }
    return shadow.get(key);
  }

  return {
    get(drillId, method) {
      return read(bestKey(drillId, method));
    },
    submit(drillId, method, elapsedSeconds) {
      const key = bestKey(drillId, method);
      const prev = read(key);
      const isNewBest = prev === undefined || elapsedSeconds < prev;
      const best = updateBest(prev, elapsedSeconds);
      if (isNewBest) {
        shadow.set(key, best);
        if (persistent && storage) {
          try {
            storage.setItem(key, JSON.stringify(best));
          } catch {
            persistent = false;
          }
        }
      }
      return { best, isNewBest };
    },
    get persistent() {
      return persistent;
    },
  };
}
