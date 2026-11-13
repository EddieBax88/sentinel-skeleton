import { useId, useLayoutEffect, useRef } from "react";
import { FIXED, PROSE } from "../copy/strings";
import type { GuidedView } from "../logic/guided";
import type { ClickView, StepLabel, StepView } from "../logic/stepEngine";

export interface GuidedStepFlowProps {
  view: GuidedView;
  /** Called with the open click's depth and the option value that was activated. */
  onPick: (depth: number, value: string) => void;
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

const FOCUS_RING =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Check mark and "correct" text for an answered click, with its reason as plain text. */
function AnsweredClick(props: {
  click: ClickView;
  why: string | undefined;
  groupLabel: string;
  groupRef?: (el: HTMLDivElement | null) => void;
}) {
  const { click, why, groupLabel, groupRef } = props;
  const picked = click.options.find((o) => o.value === click.selected);
  return (
    <div
      role="group"
      aria-label={groupLabel}
      tabIndex={-1}
      ref={groupRef}
      className={`flex flex-col gap-1 ${FOCUS_RING}`}
    >
      <p className="text-ink">
        <span aria-hidden="true" className="text-primary">
          {"\u2713 "}
        </span>
        <span>{picked?.text ?? click.selected}</span>
        <span>{` \u2013 ${FIXED.verdictCorrect}`}</span>
      </p>
      {why !== undefined && why !== "" ? <p className="text-ink">{why}</p> : null}
    </div>
  );
}

function OpenClick(props: {
  click: ClickView;
  groupLabel: string;
  triedValue: string | undefined;
  groupRef?: (el: HTMLDivElement | null) => void;
  onPick: GuidedStepFlowProps["onPick"];
}) {
  const { click, groupLabel, triedValue, groupRef, onPick } = props;
  return (
    <div
      role="group"
      aria-label={groupLabel}
      tabIndex={-1}
      ref={groupRef}
      className={`flex flex-wrap gap-2 ${FOCUS_RING}`}
    >
      {click.options.map((o) => {
        const tried = triedValue !== undefined && o.value === triedValue;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(click.depth, o.value)}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border-2 px-4 py-2 text-left text-ink ${FOCUS_RING} ${
              tried ? "border-primary bg-surface" : "border-muted bg-night"
            }`}
          >
            <span>{o.text}</span>
            {tried ? <span>{`(${FIXED.verdictIncorrect})`}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Guided code-path trail: one section and h2 per step, answered clicks show only the accepted pick. */
export function GuidedStepFlow({ view, onPick }: GuidedStepFlowProps) {
  const baseId = useId();
  const headingRefs = useRef<Array<HTMLHeadingElement | null>>([]);
  const secondIndexGroup = useRef<HTMLDivElement | null>(null);
  const previousClicks = useRef<number | null>(null);

  const { flow } = view;
  const clickTotal = flow.steps.reduce((n, s) => n + s.clicks.length, 0);

  // Same commit as the new click (Req 14.5): new step heading, or the second Index group.
  // An incorrect pick adds no click, so focus stays on the Option that was activated.
  useLayoutEffect(() => {
    const before = previousClicks.current;
    previousClicks.current = clickTotal;
    if (before === null || clickTotal <= before) return;
    const last = flow.steps[flow.steps.length - 1];
    if (last === undefined) return;
    const stepsBefore = flow.steps.slice(0, -1).reduce((n, s) => n + s.clicks.length, 0);
    if (last.label === "index" && last.clicks.length === 2 && before > stepsBefore) {
      secondIndexGroup.current?.focus();
      return;
    }
    headingRefs.current[flow.steps.length - 1]?.focus();
  }, [clickTotal, flow.steps]);

  function renderClick(step: StepView, click: ClickView, c: number) {
    const isIndex = step.label === "index";
    const groupLabel = isIndex
      ? c === 0
        ? FIXED.indexEntryGroup
        : FIXED.indexNumberGroup
      : HEADINGS[step.label];
    const groupRef =
      isIndex && c === 1
        ? (el: HTMLDivElement | null) => {
            secondIndexGroup.current = el;
          }
        : undefined;
    if (click.selected !== undefined) {
      return (
        <AnsweredClick
          key={click.depth}
          click={click}
          why={view.whys[click.depth]}
          groupLabel={groupLabel}
          groupRef={groupRef}
        />
      );
    }
    return (
      <OpenClick
        key={click.depth}
        click={click}
        groupLabel={groupLabel}
        triedValue={view.triedValue}
        groupRef={groupRef}
        onPick={onPick}
      />
    );
  }

  function renderStep(step: StepView, i: number) {
    const headingId = `${baseId}-h-${i}`;
    return (
      <section key={`${step.label}-${i}`} aria-labelledby={headingId} className="flex flex-col gap-2">
        <h2
          id={headingId}
          tabIndex={-1}
          ref={(el) => {
            headingRefs.current[i] = el;
          }}
          className={`text-lg font-semibold text-primary ${FOCUS_RING}`}
        >
          {HEADINGS[step.label]}
        </h2>
        {step.clicks.map((click, c) => renderClick(step, click, c))}
      </section>
    );
  }

  const fb = view.feedback;
  const verdictLine =
    fb === undefined
      ? null
      : fb.kind === "correct"
        ? `\u2713 ${FIXED.verdictCorrect}. ${PROSE.guidedCorrectLine}`
        : `\u2717 ${FIXED.verdictIncorrect}. ${PROSE.guidedPickAgain}`;

  return (
    <div className="flex flex-col gap-4">
      {flow.steps.map(renderStep)}
      {flow.showRowNote ? (
        <section aria-labelledby={`${baseId}-row`} className="flex flex-col gap-2">
          <h2 id={`${baseId}-row`} className="text-lg font-semibold text-primary">
            {FIXED.stepRow}
          </h2>
          <p className="text-ink">{PROSE.rowLineIntro}</p>
        </section>
      ) : null}
      {verdictLine !== null ? (
        <p role="status" className="text-ink">
          {verdictLine}
        </p>
      ) : null}
    </div>
  );
}

export default GuidedStepFlow;
