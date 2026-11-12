import { useId, useLayoutEffect, useRef } from "react";
import { FIXED, PROSE } from "../copy/strings";
import type { ClickView, FlowView, StepLabel, StepView } from "../logic/stepEngine";

export interface StepFlowProps {
  view: FlowView;
  /** Called with the click's depth and the option value that was activated. */
  onPick: (depth: number, value: string) => void;
  /** When true every option is disabled (after the check or at expiry). */
  disabled?: boolean;
}

const HEADINGS: Readonly<Record<StepLabel, string>> = {
  keyword: FIXED.stepKeyword,
  index: FIXED.stepIndex,
  chapter: FIXED.stepChapter,
  article: FIXED.stepArticle,
  part: FIXED.stepPart,
  section: FIXED.stepSection,
  table: FIXED.stepTable,
};

const GAP = "gap-2"; // 8px

function OptionGroup(props: {
  click: ClickView;
  groupLabel: string;
  groupRef?: (el: HTMLDivElement | null) => void;
  onPick: StepFlowProps["onPick"];
  disabled: boolean;
}) {
  const { click, groupLabel, groupRef, onPick, disabled } = props;
  return (
    <div
      role="group"
      aria-label={groupLabel}
      tabIndex={-1}
      ref={groupRef}
      className={`flex flex-wrap ${GAP} focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary`}
    >
      {click.options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.selected}
          disabled={disabled}
          onClick={() => onPick(click.depth, o.value)}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center ${GAP} rounded-md border-2 px-4 py-2 text-left text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 ${
            o.selected ? "border-primary bg-surface font-semibold" : "border-muted bg-night"
          }`}
        >
          <span aria-hidden="true" className="inline-block w-5 text-primary">
            {o.selected ? "\u2713" : ""}
          </span>
          <span>{o.text}</span>
        </button>
      ))}
    </div>
  );
}

/** Labeled steps of the code-path trail: one section and h2 per step, option buttons per click. */
export function StepFlow({ view, onPick, disabled = false }: StepFlowProps) {
  const baseId = useId();
  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const secondIndexGroup = useRef<HTMLDivElement | null>(null);
  const previousClicks = useRef<number | null>(null);

  const clickTotal = view.steps.reduce((n, s) => n + s.clicks.length, 0);

  // Move focus in the same commit that adds a click (Req 14.5): the new step heading,
  // or the second Index group when the new click joins the Index step.
  useLayoutEffect(() => {
    const before = previousClicks.current;
    previousClicks.current = clickTotal;
    if (before === null || clickTotal <= before) return;
    const last = view.steps[view.steps.length - 1];
    if (last === undefined) return;
    if (last.label === "index" && last.clicks.length === 2 && secondIndexGroup.current) {
      const prevSteps = before;
      const stepsBefore = view.steps.slice(0, -1).reduce((n, s) => n + s.clicks.length, 0);
      if (prevSteps > stepsBefore) {
        secondIndexGroup.current.focus();
        return;
      }
    }
    headingRefs.current[view.steps.length - 1]?.focus();
  }, [clickTotal, view.steps]);

  function renderStep(step: StepView, i: number) {
    const headingId = `${baseId}-h-${i}`;
    const isIndex = step.label === "index";
    return (
      <section key={`${step.label}-${i}`} aria-labelledby={headingId} className="flex flex-col gap-2">
        <h2
          id={headingId}
          tabIndex={-1}
          ref={(el) => {
            headingRefs.current[i] = el;
          }}
          className="text-lg font-semibold text-primary focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {HEADINGS[step.label]}
        </h2>
        {step.clicks.map((click, c) => (
          <OptionGroup
            key={click.depth}
            click={click}
            groupLabel={
              isIndex
                ? c === 0
                  ? FIXED.indexEntryGroup
                  : FIXED.indexNumberGroup
                : HEADINGS[step.label]
            }
            groupRef={
              isIndex && c === 1
                ? (el) => {
                    secondIndexGroup.current = el;
                  }
                : undefined
            }
            onPick={onPick}
            disabled={disabled}
          />
        ))}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {view.steps.map(renderStep)}
      {view.showRowNote ? (
        <section aria-labelledby={`${baseId}-row`} className="flex flex-col gap-2">
          <h2 id={`${baseId}-row`} className="text-lg font-semibold text-primary">
            {FIXED.stepRow}
          </h2>
          <p className="text-ink">{PROSE.rowLineIntro}</p>
        </section>
      ) : null}
    </div>
  );
}

export default StepFlow;
