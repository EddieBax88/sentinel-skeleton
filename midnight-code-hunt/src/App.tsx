import { Component, useMemo, useState, type ReactNode } from "react";
import { BUILD_MODE } from "./config";
import { FIXED, PROSE } from "./copy/strings";
import { checkedNames2023 } from "./data/checkedNames2023";
import { checkedNames2026 } from "./data/checkedNames2026";
import { DRILL_LIBRARY } from "./data/drillLibrary";
import { buildNamesIndex } from "./logic/displayName";
import { filterDrills, type BuildMode, type DrillEntry } from "./logic/filterDrills";
import type { MethodId } from "./model/types";
import { DrillPicker, type DrillMode } from "./ui/DrillPicker";
import { DrillScreen } from "./ui/DrillScreen";
import { GuidedScreen } from "./ui/GuidedScreen";
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

interface OpenDrill {
  drillId: string;
  mode: DrillMode;
  initialMethod?: MethodId;
}

/** Picker-to-screen wiring. Exported so tests can render it with fixture entries. */
export function AppView({
  entries,
  buildMode,
}: {
  entries: readonly DrillEntry[];
  buildMode: BuildMode;
}) {
  // null = picker.
  const [open, setOpen] = useState<OpenDrill | null>(null);
  const [guidedFinished, setGuidedFinished] = useState(false);

  const openEntry =
    open === null ? undefined : entries.find((e) => e.drill.def.id === open.drillId);
  let title: string;
  if (open === null) title = FIXED.pickerHeading;
  else if (open.mode === "guided" && guidedFinished) title = FIXED.guidedEndHeading;
  else title = openEntry?.drill.def.label ?? FIXED.drillHeadingFallback;
  const back = () => {
    setGuidedFinished(false);
    setOpen(null);
  };

  return (
    <Shell title={title}>
      {open === null ? (
        <>
          <DrillPicker
            entries={entries}
            buildMode={buildMode}
            onOpen={(drillId, mode) => {
              setGuidedFinished(false);
              setOpen({ drillId, mode });
            }}
          />
          <StorageNote />
        </>
      ) : (
        <DrillErrorBoundary key={`${open.drillId}:${open.mode}`} onBack={back}>
          {open.mode === "guided" ? (
            <GuidedScreen
              drillId={open.drillId}
              entries={entries}
              buildMode={buildMode}
              onBack={back}
              onRunTimed={(method) => {
                setGuidedFinished(false);
                setOpen({ drillId: open.drillId, mode: "timed", initialMethod: method });
              }}
              onPhaseChange={(phase) => setGuidedFinished(phase === "finished")}
            />
          ) : (
            <DrillScreen
              drillId={open.drillId}
              entries={entries}
              buildMode={buildMode}
              onBack={back}
              initialMethod={open.initialMethod}
            />
          )}
        </DrillErrorBoundary>
      )}
    </Shell>
  );
}

export default function App() {
  const entries = useMemo(() => filterDrills(DRILL_LIBRARY, BUILD_MODE), []);
  const names = useMemo(
    () => buildNamesIndex({ y2023: checkedNames2023, y2026: checkedNames2026 }),
    [],
  );
  return (
    <NamesContext.Provider value={names}>
      <AppView entries={entries} buildMode={BUILD_MODE} />
    </NamesContext.Provider>
  );
}
