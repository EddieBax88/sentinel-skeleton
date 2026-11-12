import { useEffect } from "react";
import { ANNOUNCE, FIXED, PROSE, SENTINEL_URL } from "../copy/strings";
import type { SubmitOutcome } from "../logic/bestTimes";
import type { ResultModel, ResultRow, Verdict } from "../logic/grading";
import { formatTime } from "../logic/timer";
import { GAP_CLASS, STACK_CLASS, TARGET_CLASS } from "./layout";
import { useAnnouncer } from "./providers";

export interface ResultScreenProps {
  model: ResultModel;
  /** Outcome of the best-times submit; present only for a correct, checked result. */
  outcome?: SubmitOutcome;
  /** True when best times cannot be saved (storage unavailable). */
  storageUnavailable?: boolean;
  onTryAgain: () => void;
  onBack: () => void;
}

const LEVEL_LABELS: Readonly<Record<string, string>> = {
  chapter: FIXED.stepChapter,
  annex: FIXED.stepAnnex,
  article: FIXED.stepArticle,
  part: FIXED.stepPart,
  section: FIXED.stepSection,
  table: FIXED.stepTable,
  row: FIXED.stepRow,
  index: FIXED.stepIndex,
};

const VERDICT_TEXT: Readonly<Record<Verdict, string>> = {
  correct: FIXED.verdictCorrect,
  incorrect: FIXED.verdictIncorrect,
  unanswered: FIXED.verdictNotAnswered,
};

const VERDICT_MARK: Readonly<Record<Verdict, string>> = {
  correct: "\u2713",
  incorrect: "\u2717",
  unanswered: "\u2014",
};

const VERDICT_COLOR: Readonly<Record<Verdict, string>> = {
  correct: "text-ok",
  incorrect: "text-danger",
  unanswered: "text-muted",
};

function VerdictLabel({ verdict }: { verdict: Verdict }) {
  return (
    <span className={`font-semibold ${VERDICT_COLOR[verdict]}`}>
      <span aria-hidden="true">{VERDICT_MARK[verdict]} </span>
      {VERDICT_TEXT[verdict]}
    </span>
  );
}

function rowTitle(row: ResultRow): string {
  if (row.kind === "keyword") return FIXED.stepKeyword;
  if (row.kind === "row-line") return FIXED.rowLineLabel;
  return LEVEL_LABELS[row.level] ?? row.level;
}

function RowItem({ row }: { row: ResultRow }) {
  const box = `flex flex-col ${GAP_CLASS} rounded border border-muted bg-surface px-3 py-2`;
  if (row.kind === "row-line") {
    const walk = row.tableWalk;
    return (
      <li className={box}>
        <span className="font-semibold">{rowTitle(row)}</span>
        <span>{PROSE.rowLineIntro}</span>
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
  const verdict: Verdict = row.verdict;
  const pick = row.pickText ?? (verdict === "unanswered" ? FIXED.noPickText : "");
  return (
    <li className={box}>
      <span className="font-semibold">{rowTitle(row)}</span>
      <span>{pick}</span>
      <VerdictLabel verdict={verdict} />
      {row.kind === "step" && row.forkSentence !== undefined ? (
        <span className="text-muted">{row.forkSentence}</span>
      ) : null}
    </li>
  );
}

export function ResultScreen({
  model,
  outcome,
  storageUnavailable = false,
  onTryAgain,
  onBack,
}: ResultScreenProps) {
  const announce = useAnnouncer();
  const correct = model.overall === "correct";
  const elapsed = formatTime(model.elapsedSeconds);

  useEffect(() => {
    const heading = document.querySelector("h1");
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1;
      heading.focus();
    }
    announce(ANNOUNCE.result(correct, model.timeUp, elapsed));
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showBest = correct && outcome !== undefined;
  const showNewBest = showBest && outcome.isNewBest && !model.timeUp;

  return (
    <section className={STACK_CLASS} aria-label={FIXED.resultHeading}>
      <p className="text-xl font-bold">
        {correct ? FIXED.overallCorrect : FIXED.overallIncorrect}
      </p>
      {model.timeUp ? <p>{PROSE.timeRanOut}</p> : null}
      <p>
        {FIXED.elapsedLabel}: {elapsed}
      </p>
      {showBest ? (
        <p>
          {FIXED.bestTimeLabel}: {formatTime(outcome.best)}
        </p>
      ) : null}
      {showNewBest ? <p>{PROSE.newBest}</p> : null}
      {storageUnavailable ? <p>{PROSE.storageNote}</p> : null}

      {model.matchedMovedFrom ? (
        <div className={STACK_CLASS}>
          <p>{PROSE.movedArticle}</p>
          <p>{PROSE.verdictsAgainst2023}</p>
          {model.editionNote !== undefined ? <p>{model.editionNote}</p> : null}
        </div>
      ) : null}

      <ol className={STACK_CLASS}>
        {model.rows.map((row, i) => (
          <RowItem key={i} row={row} />
        ))}
      </ol>

      <dl className={STACK_CLASS}>
        <div>
          <dt className="font-semibold">{FIXED.answerLabel}</dt>
          <dd>{model.answer}</dd>
        </div>
        <div>
          <dt className="font-semibold">{FIXED.citationLabel}</dt>
          <dd>{model.citation}</dd>
        </div>
        <div>
          <dt className="font-semibold">{FIXED.hintLabel}</dt>
          <dd>{model.hint}</dd>
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
          onClick={onTryAgain}
          className={`${TARGET_CLASS} rounded border-2 border-primary px-4 py-2 font-semibold`}
        >
          {FIXED.tryAgainButton}
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

export default ResultScreen;
