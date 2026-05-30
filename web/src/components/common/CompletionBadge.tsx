import { useTranslation } from 'react-i18next';
import type {
  SetCompletionState,
  ExerciseCompletionState,
  SessionCompletionState,
  ExerciseCounts,
  SessionCounts,
  MealCompletionState,
  DayCompletionState,
  DayCompletionCounts,
} from '@/lib/completionState';

// ── Inline SVG icon atoms ────────────────────────────────────────────────────
// Equivalent to lucide-react's Check, SkipForward, CheckCircle2, AlertCircle.
// Inline because lucide-react is not a project dependency; matching the
// codebase's existing pattern of inline unicode / SVG micro-icons.

function IconCheck({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSkipForward({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

function IconCheckCircle2({ size = 12 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconAlertCircle({ size = 12 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── Token-class helpers ──────────────────────────────────────────────────────

/** Pill using the accent (gold) triplet — for completed states. */
const accentPill =
  'inline-flex items-center gap-[3px] rounded-sm px-1.5 py-[1px] text-[10px] font-medium tabular-nums text-accent bg-accent-bg border border-accent-br';

/** Pill using the neutral-muted triplet — for skipped states. */
const mutedPill =
  'inline-flex items-center gap-[3px] rounded-sm px-1.5 py-[1px] text-[10px] font-medium tabular-nums text-text3 bg-bg2 border border-border';

// ── Props ────────────────────────────────────────────────────────────────────

type SetBadgeProps = {
  kind: 'set';
  state: SetCompletionState;
  counts?: undefined;
};

type ExerciseBadgeProps = {
  kind: 'exercise';
  state: ExerciseCompletionState;
  counts?: ExerciseCounts;
};

type SessionBadgeProps = {
  kind: 'session';
  state: SessionCompletionState;
  counts?: SessionCounts;
};

/**
 * Nutrition: single-meal eaten indicator.
 * 'not-touched' → nothing rendered (returns null).
 * 'eaten'       → accent pill with CheckCircle2.
 */
type MealBadgeProps = {
  kind: 'meal';
  state: MealCompletionState;
  counts?: undefined;
};

/**
 * Nutrition: day-level aggregate eaten indicator.
 * 'not-touched' → nothing rendered (returns null).
 * 'all-eaten'   → accent pill with CheckCircle2 + interpolated count string.
 */
type DayBadgeProps = {
  kind: 'day';
  state: DayCompletionState;
  counts?: DayCompletionCounts;
};

export type CompletionBadgeProps =
  | SetBadgeProps
  | ExerciseBadgeProps
  | SessionBadgeProps
  | MealBadgeProps
  | DayBadgeProps;

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Renders a compact completion-state badge for a set, exercise, or session.
 *
 * Visual contract per design-reviewer handoff findings 2-6:
 * - Set:      single icon (Check or SkipForward), no text, 16 px. Not-reached → nothing.
 * - Exercise: aggregate pill(s). fully-complete → accent + CheckCircle2 eyebrow + "N/M".
 *             mixed → two pills side-by-side (accent first, muted second).
 * - Session:  same dual-pill pattern, accent "all complete" or accent + muted counts.
 *
 * Token mapping:
 *   completed/all-complete → text-accent / bg-accent-bg / border-accent-br
 *   skipped/mixed muted    → text-text3 / bg-bg2 / border-border
 *   not-reached            → no badge rendered
 */
export function CompletionBadge(props: CompletionBadgeProps) {
  const { t } = useTranslation();

  if (props.kind === 'set') {
    return <SetBadge state={props.state} t={t} />;
  }
  if (props.kind === 'exercise') {
    return <ExerciseBadge state={props.state} counts={props.counts} t={t} />;
  }
  if (props.kind === 'meal') {
    return <MealBadge state={props.state} t={t} />;
  }
  if (props.kind === 'day') {
    return <DayBadge state={props.state} counts={props.counts} t={t} />;
  }
  return <SessionBadge state={props.state} counts={props.counts} t={t} />;
}

// ── Set badge ────────────────────────────────────────────────────────────────

function SetBadge({
  state,
  t,
}: {
  state: SetCompletionState;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (state === 'not-reached') return null;

  if (state === 'completed') {
    return (
      <span
        className="inline-flex items-center text-accent"
        aria-label={t('training.completionState.setCompleted')}
        title={t('training.completionState.setCompleted')}
      >
        <IconCheck size={16} />
      </span>
    );
  }

  // skipped
  return (
    <span
      className="inline-flex items-center text-text3"
      aria-label={t('training.completionState.setSkipped')}
      title={t('training.completionState.setSkipped')}
    >
      <IconSkipForward size={16} />
    </span>
  );
}

// ── Exercise badge ───────────────────────────────────────────────────────────

function ExerciseBadge({
  state,
  counts,
  t,
}: {
  state: ExerciseCompletionState;
  counts?: ExerciseCounts;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (state === 'none') return null;
  if (!counts) return null;

  const completedLabel = t('training.completionState.exerciseCompleted', {
    done: counts.completed,
    total: counts.total,
  });

  if (state === 'fully-complete' || state === 'partial-no-skips') {
    return (
      <span
        className={accentPill}
        aria-label={completedLabel}
        title={completedLabel}
      >
        <IconCheckCircle2 size={12} />
        {counts.completed}/{counts.total}
      </span>
    );
  }

  // mixed — completed pill + skipped pill side-by-side
  const skippedLabel = t('training.completionState.exerciseSkippedSuffix', {
    count: counts.skipped,
  });
  return (
    <span className="inline-flex items-center gap-1">
      <span className={accentPill} title={completedLabel}>
        <IconCheckCircle2 size={12} />
        {counts.completed}/{counts.total}
      </span>
      <span className={mutedPill} title={skippedLabel}>
        <IconAlertCircle size={12} />
        {counts.skipped}
      </span>
    </span>
  );
}

// ── Meal badge (nutrition) ───────────────────────────────────────────────────

function MealBadge({
  state,
  t,
}: {
  state: MealCompletionState;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (state === 'not-touched') return null;

  // 'eaten'
  const label = t('nutrition.completionState.mealEaten');
  return (
    <span
      className={accentPill}
      aria-label={label}
      title={label}
    >
      <IconCheckCircle2 size={12} />
      {label}
    </span>
  );
}

// ── Day badge (nutrition) ────────────────────────────────────────────────────

function DayBadge({
  state,
  counts,
  t,
}: {
  state: DayCompletionState;
  counts?: DayCompletionCounts;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (state === 'not-touched') return null;

  // 'all-eaten'
  const label = counts
    ? t('nutrition.completionState.dayAllEaten', { eaten: counts.eaten, total: counts.total })
    : t('nutrition.completionState.mealEaten');
  return (
    <span
      className={accentPill}
      aria-label={label}
      title={label}
    >
      <IconCheckCircle2 size={12} />
      {label}
    </span>
  );
}

// ── Session badge ────────────────────────────────────────────────────────────

function SessionBadge({
  state,
  counts,
  t,
}: {
  state: SessionCompletionState;
  counts?: SessionCounts;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (state === 'none' || state === 'in-progress') return null;
  if (!counts) return null;

  if (state === 'all-complete') {
    const label = t('training.completionState.sessionAllComplete');
    return (
      <span
        className={accentPill}
        aria-label={label}
        title={label}
      >
        <IconCheckCircle2 size={12} />
        {label}
      </span>
    );
  }

  // mixed
  const mixedLabel = t('training.completionState.sessionMixed', {
    completed: counts.completed,
    skipped: counts.skipped,
  });
  const completedLabel = t('training.completionState.exerciseCompleted', {
    done: counts.completed,
    total: counts.total,
  });
  const skippedLabel = t('training.completionState.exerciseSkippedSuffix', {
    count: counts.skipped,
  });
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={mixedLabel}
    >
      <span className={accentPill} title={completedLabel}>
        <IconCheckCircle2 size={12} />
        {counts.completed}/{counts.total}
      </span>
      <span className={mutedPill} title={skippedLabel}>
        <IconAlertCircle size={12} />
        {counts.skipped}
      </span>
    </span>
  );
}
