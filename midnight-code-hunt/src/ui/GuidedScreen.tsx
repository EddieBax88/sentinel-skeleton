import { useEffect, useMemo, useReducer, useRef } from "react";
import { ANNOUNCE, FIXED, PROSE } from "../copy/strings";
import { createGuidedReducer, viewGuided } from "../logic/guided";
import type { GuidedState } from "../logic/guided";
import type { BuildMode, DrillEntry } from "../logic/filterDrills";
import { availableMethods } from "../model/methods";
import type { MethodId } from "../model/types";
import { GuidedEndScreen } from "./GuidedEndScreen";
import { GuidedStepFlow } from "./GuidedStepFlow";
import { STACK_CLASS, TARGET_CLASS } from "./layout";
import { MethodSelector } from "./MethodSelector";
import { useAnnouncer, useNames } from "./providers";

export interface GuidedScreenProps {
  /** Id of the drill to run. */
  drillId: string;
  /** The filtered drill entries (the same list the picker shows). */
  entries: readonly DrillEntry[];
  buildMode: BuildMode;
  /** Leave the drill and return to the picker. */
  onBack: () => void;
  /** Run the same drill Timed, with the Method in use at the end of the Guided run. */
  onRunTimed: (method: MethodId) => void;
  /** Reports the run's phase whenever it changes (App uses it to title the Shell). */
  onPhaseChange?: (phase: GuidedState["phase"]) => void;
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
 * One Guided run: Draft rule, question, method choice, and the step flow with an
 * immediate verdict after each pick; the full-path screen once the user asks for it.
 * No countdown, no Check button, and no best times. The wrapping Shell (and its <h1>)
 * is supplied by App.
 */
export function GuidedScreen({
  drillId,
  entries,
  buildMode,
  onBack,
  onRunTimed,
  onPhaseChange,
}: GuidedScreenProps) {
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
    <ActiveGuided
      entry={entry}
      buildMode={buildMode}
      onBack={onBack}
      onRunTimed={onRunTimed}
      onPhaseChange={onPhaseChange}
    />
  );
}

function ActiveGuided({
  entry,
  buildMode,
  onBack,
  onRunTimed,
  onPhaseChange,
}: {
  entry: DrillEntry;
  buildMode: BuildMode;
  onBack: () => void;
  onRunTimed: (method: MethodId) => void;
  onPhaseChange?: (phase: GuidedState["phase"]) => void;
}) {
  const { drill, draft } = entry;
  const names = useNames();
  const announce = useAnnouncer();

  const reducer = useMemo(() => createGuidedReducer(), []);
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): GuidedState => reducer({ phase: "idle" }, { type: "START", drill }),
  );

  const feedback = state.phase === "guiding" ? state.feedback : undefined;
  const pathEnded = state.phase === "guiding" && viewGuided(state, names).pathEnded;
  const fullPathRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    onPhaseChange?.(state.phase);
    // Report only when the phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Post the verdict of the newest pick. Each pick makes a new feedback object.
  useEffect(() => {
    if (feedback === undefined) return;
    announce(
      ANNOUNCE.guided(feedback.kind, feedback.kind === "correct" ? feedback.why : undefined),
    );
    // Announce once per feedback object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  // When the path has ended, the full-path button takes focus.
  useEffect(() => {
    if (pathEnded) fullPathRef.current?.focus();
  }, [pathEnded]);

  const back = () => {
    dispatch({ type: "LEAVE" });
    onBack();
  };

  if (state.phase === "finished") {
    return (
      <GuidedEndScreen
        drill={state.drill}
        method={state.method}
        picks={state.picks}
        onRunTimed={() => onRunTimed(state.method)}
        onBack={back}
      />
    );
  }

  if (state.phase !== "guiding") {
    // After LEAVE the parent switches screens; render nothing meanwhile.
    return null;
  }

  const view = viewGuided(state, names);
  const showDraft = buildMode !== "production" && draft;

  return (
    <section className={STACK_CLASS} aria-label={drill.def.label}>
      {showDraft ? <p>{FIXED.draftBadge}</p> : null}
      <p className="text-lg">{state.drill.question}</p>
      <MethodSelector
        available={availableMethods(state.drill)}
        selected={state.method}
        onSelect={(method) => dispatch({ type: "SELECT_METHOD", method })}
      />
      <GuidedStepFlow
        view={view}
        onPick={(depth, value) => dispatch({ type: "PICK", depth, value })}
      />
      {view.pathEnded ? (
        <button
          type="button"
          ref={fullPathRef}
          onClick={() => dispatch({ type: "FINISH" })}
          className={`${TARGET_CLASS} self-start rounded border-2 border-primary px-4 py-2 font-semibold`}
        >
          {FIXED.showFullPathButton}
        </button>
      ) : null}
      <BackButton onBack={back} />
    </section>
  );
}

export default GuidedScreen;
