import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { PROSE } from "../copy/strings";
import { METHOD_LABELS, METHOD_ORDER } from "../model/methods";
import type { MethodId } from "../model/types";

export interface MethodSelectorProps {
  /** Methods offered for the drill. Rendered in METHOD_ORDER, Index Keyword Lookup first. */
  available: readonly MethodId[];
  selected: MethodId;
  onSelect: (method: MethodId) => void;
}

const DESCRIPTIONS: Readonly<Record<MethodId, string>> = {
  index: PROSE.methodIndexDescription,
  toc: PROSE.methodTocDescription,
};

/** Radio group for choosing the lookup method. Arrow keys move and select, with wrap. */
export function MethodSelector({ available, selected, onSelect }: MethodSelectorProps) {
  const refs = useRef<Partial<Record<MethodId, HTMLDivElement | null>>>({});
  const methods = METHOD_ORDER.filter((m) => available.includes(m));
  // Roving tabIndex: the selected radio is the keyboard stop; fall back to the first if none match.
  const tabStop: MethodId | undefined = methods.includes(selected) ? selected : methods[0];

  function move(from: number, step: 1 | -1) {
    const next = methods[(from + step + methods.length) % methods.length];
    if (next === undefined) return;
    onSelect(next);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        move(index, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        move(index, -1);
        break;
      case " ":
      case "Enter": {
        e.preventDefault();
        const m = methods[index];
        if (m !== undefined) onSelect(m);
        break;
      }
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-label="Method" className="flex flex-col gap-3 sm:flex-row">
      {methods.map((m, i) => {
        const checked = m === selected;
        return (
          <div
            key={m}
            ref={(el) => {
              refs.current[m] = el;
            }}
            role="radio"
            aria-checked={checked}
            tabIndex={m === tabStop ? 0 : -1}
            onClick={() => onSelect(m)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex min-h-[44px] min-w-[44px] flex-1 cursor-pointer flex-col gap-1 rounded-md border-2 bg-surface px-4 py-3 text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              checked ? "border-primary" : "border-muted"
            }`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="inline-block w-5 text-primary">
                {checked ? "\u2713" : ""}
              </span>
              <span>{METHOD_LABELS[m]}</span>
            </span>
            <span className="text-sm text-muted">{DESCRIPTIONS[m]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default MethodSelector;
