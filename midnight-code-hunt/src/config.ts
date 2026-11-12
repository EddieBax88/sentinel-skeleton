// Reads import.meta.env exactly once; the rest of the app imports these constants.
import { getBuildMode, type BuildMode } from "./logic/filterDrills";
import { parseSwitcherUrl } from "./logic/switcher";

/** Validated App 2 address, or null when unset or invalid (Req 15). */
export const SWITCHER_URL: string | null = parseSwitcherUrl(
  import.meta.env.VITE_DEAD_CIRCUIT_CHECK_URL,
);

/** PROD always yields "production" (Req 4.2). */
export const BUILD_MODE: BuildMode = getBuildMode({
  PROD: import.meta.env.PROD,
  MODE: import.meta.env.MODE,
});
