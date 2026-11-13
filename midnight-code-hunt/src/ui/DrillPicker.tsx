import { FIXED, PROSE } from "../copy/strings";
import type { BuildMode, DrillEntry } from "../logic/filterDrills";
import { formatTime } from "../logic/timer";
import { METHOD_LABELS, METHOD_ORDER } from "../model/methods";
import { GAP_CLASS, STACK_CLASS, TARGET_CLASS } from "./layout";
import { useBestTimes } from "./providers";

export type DrillMode = "guided" | "timed";

export interface DrillPickerProps {
  entries: readonly DrillEntry[];
  buildMode: BuildMode;
  onOpen: (drillId: string, mode: DrillMode) => void;
}

const MODES: readonly { mode: DrillMode; text: string }[] = [
  { mode: "guided", text: FIXED.modeGuided },
  { mode: "timed", text: FIXED.modeTimed },
];

const labelId = (drillId: string) => `drill-label-${drillId}`;

/**
 * Lists the filtered drills. Each drill shows its label, badges, and best times,
 * then two native <button>s: Guided first, Timed second. Each button's accessible
 * name is its own text plus the drill label. The wrapping Shell (and its <h1>)
 * is supplied by App.
 */
export function DrillPicker({ entries, buildMode, onOpen }: DrillPickerProps) {
  const store = useBestTimes();
  const isProduction = buildMode === "production";
  const emptyMessage = isProduction ? PROSE.pickerComingSoon : PROSE.pickerNoDrillsDev;

  return (
    <section className={STACK_CLASS} aria-label={FIXED.pickerHeading}>
      <p>{PROSE.pickerBenefit}</p>
      <p>{PROSE.pickerNecNote}</p>
      {entries.length === 0 ? (
        <p role="status">{emptyMessage}</p>
      ) : (
        <ul className={STACK_CLASS}>
          {entries.map(({ drill, draft }) => {
            const { id, label, movedFrom } = drill.def;
            const times = METHOD_ORDER.flatMap((method) => {
              const best = store.get(id, method);
              return best === undefined ? [] : [{ method, best }];
            });
            return (
              <li key={id} className={`${STACK_CLASS} rounded border border-current px-3 py-2`}>
                <span id={labelId(id)} className="font-semibold">
                  {label}
                </span>
                {!isProduction && draft ? <span>{FIXED.draftBadge}</span> : null}
                {movedFrom !== undefined ? <span>{FIXED.movedLabel}</span> : null}
                {times.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {times.map(({ method, best }) => (
                      <li key={method}>
                        {METHOD_LABELS[method]}: {FIXED.bestTimeLabel} {formatTime(best)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className={`flex flex-row ${GAP_CLASS}`}>
                  {MODES.map(({ mode, text }) => {
                    const buttonId = `drill-${mode}-${id}`;
                    return (
                      <button
                        key={mode}
                        id={buttonId}
                        type="button"
                        aria-labelledby={`${buttonId} ${labelId(id)}`}
                        onClick={() => onOpen(id, mode)}
                        className={`${TARGET_CLASS} rounded border border-current px-3 py-2`}
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DrillPicker;
