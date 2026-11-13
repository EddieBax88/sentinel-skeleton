import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { FIXED, PROSE } from "../copy/strings";
import { bestTimeToSubmit, createAttemptReducer } from "../logic/attempt";
import type { AttemptState } from "../logic/attempt";
import type { SubmitOutcome } from "../logic/bestTimes";
import type { BuildMode, DrillEntry } from "../logic/filterDrills";
import { canCheck, treeFor, viewFlow } from "../logic/stepEngine";
import { availableMethods } from "../model/methods";
import type { MethodId } from "../model/types";
import { STACK_CLASS, TARGET_CLASS } from "./layout";
import { MethodSelector } from "./MethodSelector";
import { useBestTimes, useClock, useNames } from "./providers";
import { ResultScreen } from "./ResultScreen";
import { StepFlow } from "./StepFlow";
import { TimerDisplay } from "./TimerDisplay";

export interface DrillScreenProps {
  /** Id of the drill to run. */
  drillId: string;
  /** The filtered drill entries (the same list the picker shows). */
  entries: readonly DrillEntry[];
  buildMode: BuildMode;
  /** Leave the drill and return to the picker. */
  onBack: () => void;
  /** Start the attempt with this Method when the drill offers it. */
  initialMethod?: MethodId;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className={`${TARGET_CLASS} self-start rounded border-2 border-muted px-4 py-2`}
    >
      {FIXED.backButton}
    </button>
  );
}

/**
 * One drill attempt: question, countdown, method choice, and the step flow while
 * running; the result screen once checked or expired. The wrapping Shell (and its
 * <h1>) is supplied by App.
 */
export function DrillScreen({
  drillId,
  entries,
  buildMode,
  onBack,
  initialMethod,
}: DrillScreenProps) {
  const entry = entries.find((e) => e.drill.def.id === drillId);
  if (entry === undefined) {
    return (
      <section className={STACK_CLASS}>
        <p role="alert">{PROSE.drillUnavailable}</p>
        <BackButton onBack={onBack} />
      </section>
    );
  }
  return (
    <ActiveDrill
      entry={entry}
      buildMode={buildMode}
      onBack={onBack}
      initialMethod={initialMethod}
    />
  );
}

function ActiveDrill({
  entry,
  buildMode,
  onBack,
  initialMethod,
}: {
  entry: DrillEntry;
  buildMode: BuildMode;
  onBack: () => void;
  initialMethod?: MethodId;
}) {
  const { drill, draft } = entry;
  const names = useNames();
  const clock = useClock();
  const store = useBestTimes();

  const reducer = useMemo(() => createAttemptReducer(names), [names]);
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): AttemptState => {
      const started = reducer({ phase: "picker" }, { type: "START", drill, nowMs: clock.nowMs() });
      if (initialMethod !== undefined && availableMethods(drill).includes(initialMethod)) {
        return reducer(started, { type: "SELECT_METHOD", method: initialMethod });
      }
      return started;
    },
  );

  // Submit the best time once per checked attempt; the ref also guards a repeated effect run.
  const submittedFor = useRef<AttemptState | null>(null);
  const [submitted, setSubmitted] = useState<{
    state: AttemptState;
    outcome: SubmitOutcome;
  } | null>(null);
  useEffect(() => {
    if (submittedFor.current === state) return;
    const submission = bestTimeToSubmit(state);
    if (submission === null) return;
    submittedFor.current = state;
    const outcome = store.submit(
      submission.drillId,
      submission.method,
      submission.elapsedSeconds,
    );
    setSubmitted({ state, outcome });
  }, [state, store]);

  const back = () => {
    dispatch({ type: "LEAVE" });
    onBack();
  };

  if (state.phase === "checked" || state.phase === "expired") {
    const outcome = submitted !== null && submitted.state === state ? submitted.outcome : undefined;
    return (
      <ResultScreen
        model={state.result}
        outcome={outcome}
        storageUnavailable={!store.persistent}
        onTryAgain={() => dispatch({ type: "RESTART", nowMs: clock.nowMs() })}
        onBack={back}
      />
    );
  }

  if (state.phase !== "running") {
    // After LEAVE the parent switches screens; render nothing meanwhile.
    return null;
  }

  const tree = treeFor(state.drill, state.method);
  const view = viewFlow(tree, state.picks, names);
  const checkable = canCheck(tree, state.picks);
  const showDraft = buildMode !== "production" && draft;

  return (
    <section className={STACK_CLASS} aria-label={drill.def.label}>
      {showDraft ? <p>{FIXED.draftBadge}</p> : null}
      <p className="text-lg">{state.drill.question}</p>
      <TimerDisplay
        key={state.startedAtMs}
        startedAtMs={state.startedAtMs}
        active
        onTick={(nowMs) => dispatch({ type: "TICK", nowMs })}
      />
      <MethodSelector
        available={availableMethods(state.drill)}
        selected={state.method}
        onSelect={(method) => dispatch({ type: "SELECT_METHOD", method })}
      />
      <StepFlow
        view={view}
        onPick={(depth, value) => dispatch({ type: "PICK", depth, value })}
      />
      <button
        type="button"
        disabled={!checkable}
        onClick={() => dispatch({ type: "CHECK", nowMs: clock.nowMs() })}
        className={`${TARGET_CLASS} self-start rounded border-2 border-primary px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {FIXED.checkButton}
      </button>
      <BackButton onBack={back} />
    </section>
  );
}

export default DrillScreen;
