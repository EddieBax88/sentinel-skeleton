import { useEffect } from "react";
import { ANNOUNCE, FIXED, PROSE, SENTINEL_URL } from "../copy/strings";
import { guidedPathRows } from "../logic/guided";
import type { PathRow } from "../logic/guided";
import type { StepLabel } from "../logic/stepEngine";
import type { DrillRecord, MethodId } from "../model/types";
import { GAP_CLASS, STACK_CLASS, TARGET_CLASS } from "./layout";
import { useAnnouncer, useNames } from "./providers";

export interface GuidedEndScreenProps {
  drill: DrillRecord;
  method: MethodId;
  /** Accepted picks in click order, from the finished Guided state. */
  picks: readonly string[];
  onRunTimed: () => void;
  onBack: () => void;
}

const STEP_LABELS: Readonly<Record<StepLabel, string>> = {
  keyword: FIXED.stepKeyword,
  index: FIXED.stepIndex,
  chapter: FIXED.stepChapter,
  article: FIXED.stepArticle,
  part: FIXED.stepPart,
  section: FIXED.stepSection,
  table: FIXED.stepTable,
};

function RowItem({ row }: { row: PathRow }) {
  const box = `flex flex-col ${GAP_CLASS} rounded border border-muted bg-surface px-3 py-2`;
  if (row.kind === "row-line") {
    const walk = row.tableWalk;
    return (
      <li className={box}>
        <span className="font-semibold">{FIXED.rowLineLabel}</span>
        <span>
          {FIXED.tableWalkColumn}: {walk.column}
        </span>
        <span>
          {FIXED.tableWalkRow}: {walk.row}
        </span>
        <span>
          {FIXED.tableWalkValue}: {walk.value}
        </span>
      </li>
    );
  }
  const title = row.kind === "keyword" ? FIXED.stepKeyword : STEP_LABELS[row.label];
  return (
    <li className={box}>
      <span className="font-semibold">{title}</span>
      <span>{row.pickText}</span>
      {row.why !== undefined && row.why !== "" ? (
        <span className="text-muted">{row.why}</span>
      ) : null}
    </li>
  );
}

/**
 * Closing screen of a Guided run: the full path with the reasons the founder wrote, the
 * answer, the citation, the hint, the Sentinel link, then Run Timed and Back. It shows no
 * timer, no overall result, and does not touch best times. The wrapping Shell (and its
 * <h1>) is supplied by App; that heading takes focus on mount.
 */
export function GuidedEndScreen({ drill, method, picks, onRunTimed, onBack }: GuidedEndScreenProps) {
  const announce = useAnnouncer();
  const names = useNames();
  const rows = guidedPathRows(drill, method, picks, names);

  useEffect(() => {
    const heading = document.querySelector("h1");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
    announce(ANNOUNCE.guidedDone);
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={STACK_CLASS} aria-label={FIXED.guidedEndHeading}>
      <p>{PROSE.guidedEndIntro}</p>

      <ol className={STACK_CLASS}>
        {rows.map((row, i) => (
          <RowItem key={i} row={row} />
        ))}
      </ol>

      <dl className={STACK_CLASS}>
        <div>
          <dt className="font-semibold">{FIXED.answerLabel}</dt>
          <dd>{drill.answer}</dd>
        </div>
        <div>
          <dt className="font-semibold">{FIXED.citationLabel}</dt>
          <dd>{drill.citation}</dd>
        </div>
        <div>
          <dt className="font-semibold">{FIXED.hintLabel}</dt>
          <dd>{drill.def.hint}</dd>
        </div>
      </dl>

      <a
        href={SENTINEL_URL}
        className={`${TARGET_CLASS} inline-flex items-center text-primary underline`}
      >
        {FIXED.sentinelLinkText}
      </a>

      <div className={`flex flex-col ${GAP_CLASS} md:flex-row`}>
        <button
          type="button"
          onClick={onRunTimed}
          className={`${TARGET_CLASS} rounded border-2 border-primary px-4 py-2 font-semibold`}
        >
          {FIXED.runTimedButton}
        </button>
        <button
          type="button"
          onClick={onBack}
          className={`${TARGET_CLASS} rounded border-2 border-muted px-4 py-2`}
        >
          {FIXED.backButton}
        </button>
      </div>
    </section>
  );
}

export default GuidedEndScreen;
