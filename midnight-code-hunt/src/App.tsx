import { Component, useMemo, useState, type ReactNode } from "react";
import { BUILD_MODE } from "./config";
import { FIXED, PROSE } from "./copy/strings";
import { checkedNames2023 } from "./data/checkedNames2023";
import { checkedNames2026 } from "./data/checkedNames2026";
import { DRILL_LIBRARY } from "./data/drillLibrary";
import { buildNamesIndex } from "./logic/displayName";
import { filterDrills } from "./logic/filterDrills";
import { DrillPicker } from "./ui/DrillPicker";
import { DrillScreen } from "./ui/DrillScreen";
import { STACK_CLASS, TARGET_CLASS } from "./ui/layout";
import { NamesContext, useBestTimes } from "./ui/providers";
import { Shell } from "./ui/Shell";

/** Shown when a drill throws while rendering (corrupt data, Req 17.9). */
function UnavailableDrill({ onBack }: { onBack: () => void }) {
  return (
    <section className={STACK_CLASS}>
      <p role="alert">{PROSE.drillUnavailable}</p>
      <button
        type="button"
        onClick={onBack}
        className={`${TARGET_CLASS} self-start rounded border-2 border-muted px-4 py-2`}
      >
        {FIXED.backButton}
      </button>
    </section>
  );
}

class DrillErrorBoundary extends Component<
  { onBack: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <UnavailableDrill onBack={this.props.onBack} />;
    return this.props.children;
  }
}

/** Rendered after the picker so it reflects any storage failure seen while reading best times. */
function StorageNote() {
  const store = useBestTimes();
  return store.persistent ? null : <p>{PROSE.storageNote}</p>;
}

export default function App() {
  // null = picker; a string = the open drill.
  const [drillId, setDrillId] = useState<string | null>(null);
  const entries = useMemo(() => filterDrills(DRILL_LIBRARY, BUILD_MODE), []);
  const names = useMemo(
    () => buildNamesIndex({ y2023: checkedNames2023, y2026: checkedNames2026 }),
    [],
  );

  const openEntry =
    drillId === null ? undefined : entries.find((e) => e.drill.def.id === drillId);
  const title =
    drillId === null ? FIXED.pickerHeading : (openEntry?.drill.def.label ?? FIXED.drillHeadingFallback);
  const back = () => setDrillId(null);

  return (
    <NamesContext.Provider value={names}>
      <Shell title={title}>
        {drillId === null ? (
          <>
            <DrillPicker entries={entries} buildMode={BUILD_MODE} onOpen={setDrillId} />
            <StorageNote />
          </>
        ) : (
          <DrillErrorBoundary key={drillId} onBack={back}>
            <DrillScreen
              drillId={drillId}
              entries={entries}
              buildMode={BUILD_MODE}
              onBack={back}
            />
          </DrillErrorBoundary>
        )}
      </Shell>
    </NamesContext.Provider>
  );
}
