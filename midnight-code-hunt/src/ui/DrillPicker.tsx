import { FIXED, PROSE } from "../copy/strings";
import type { BuildMode, DrillEntry } from "../logic/filterDrills";
import { formatTime } from "../logic/timer";
import { METHOD_LABELS, METHOD_ORDER } from "../model/methods";
import { STACK_CLASS, TARGET_CLASS } from "./layout";
import { useBestTimes } from "./providers";

export interface DrillPickerProps {
  entries: readonly DrillEntry[];
  buildMode: BuildMode;
  onOpen: (drillId: string) => void;
}

/**
 * Lists the filtered drills. Each drill is a native <button>, so Enter and Space
 * activate it. The wrapping Shell (and its <h1>) is supplied by App.
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
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onOpen(id)}
                  className={`${TARGET_CLASS} flex w-full flex-col gap-1 rounded border border-current px-3 py-2 text-left`}
                >
                  <span className="font-semibold">{label}</span>
                  {!isProduction && draft ? <span>{FIXED.draftBadge}</span> : null}
                  {movedFrom !== undefined ? <span>{FIXED.movedLabel}</span> : null}
                  {times.map(({ method, best }) => (
                    <span key={method}>
                      {METHOD_LABELS[method]}: {FIXED.bestTimeLabel} {formatTime(best)}
                    </span>
                  ))}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DrillPicker;
