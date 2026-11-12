import { createContext, useContext } from "react";
import { createBestTimesStore, type BestTimesStore } from "../logic/bestTimes";
import { buildNamesIndex, type CheckedNamesIndex } from "../logic/displayName";
import { systemClock, type Clock } from "../logic/timer";

/** Injectable time source; tests provide a fake clock. */
export const ClockContext = createContext<Clock>(systemClock);
export function useClock(): Clock {
  return useContext(ClockContext);
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined; // access denied: in-memory only (Req 12.8)
  }
}

/** Best-times store; falls back to in-memory when storage is unavailable. */
export const BestTimesContext = createContext<BestTimesStore>(
  createBestTimesStore(defaultStorage()),
);
export function useBestTimes(): BestTimesStore {
  return useContext(BestTimesContext);
}

/** Checked-names index; the default is empty until App supplies the data files. */
export const NamesContext = createContext<CheckedNamesIndex>(
  buildNamesIndex({
    y2023: { edition: 2023, entries: [] },
    y2026: { edition: 2026, entries: [] },
  }),
);
export function useNames(): CheckedNamesIndex {
  return useContext(NamesContext);
}

/** Posts a message to the polite live region. */
export type Announce = (message: string) => void;
export const AnnouncerContext = createContext<Announce>(() => {});
export function useAnnouncer(): Announce {
  return useContext(AnnouncerContext);
}
