import { useTranslation } from 'react-i18next';
import type { MuscleGroup } from '@/api/exercise-types';
import { cn } from '@/lib/cn';
import { MUSCLE_COLORS, MUSCLE_BG_COLORS, MUSCLE_ICONS } from '@/constants/training';
import type { SessionExercise } from '@/api/training-plan-types';
import type { ExerciseCompletionState, ExerciseCounts } from '@/lib/completionState';
import { CompletionBadge } from '@/components/training/CompletionBadge';

interface ExerciseCardHeaderProps {
  exercise: SessionExercise;
  muscleGroups: MuscleGroup[];
  /** Pre-formatted prescription summary (e.g. "4×4-10 · 15-22.5 kg",
   *  "40 s · 10 kg", "30 m · 40 s · 10 kg"). Built by the parent via
   *  `formatExerciseSummary` so a single helper handles every movement
   *  type. The legacy `repsStr` / `weightStr` / `setsCount` are still
   *  accepted as a fallback for callers that haven't migrated. */
  summaryText?: string;
  repsStr?: string;
  weightStr?: string;
  setsCount?: number;
  totalVolume: number;
  isOpen: boolean;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  difficulty?: string;
  /** When the parent section is a WOD format (AMRAP/EMOM/Tabata/ForTime),
   *  the "set" concept doesn't apply — the one stored row holds the round
   *  prescription. Hide the `{setsCount}×` summary prefix in that case. */
  isWod?: boolean;
  /** When true, the duplicate / remove buttons are disabled + dimmed.
   *  The chevron toggle stays clickable so trainers can still expand the
   *  row to inspect read-only content (finished exercise, past-day,
   *  finished session). */
  disabled?: boolean;
  /** Aggregate completion state for this exercise (additive, display-only). */
  exerciseCompletionState?: ExerciseCompletionState;
  /** Counts for the aggregate badge (required when exerciseCompletionState is set). */
  exerciseCounts?: ExerciseCounts;
}

export function ExerciseCardHeader({
  exercise,
  muscleGroups,
  summaryText,
  repsStr,
  weightStr,
  setsCount,
  totalVolume,
  isOpen,
  onToggle,
  onDuplicate,
  onRemove,
  difficulty,
  isWod,
  disabled,
  exerciseCompletionState,
  exerciseCounts,
}: ExerciseCardHeaderProps) {
  const { t } = useTranslation();

  const primaryMuscle = muscleGroups[0] as string | undefined;
  const muscleIcon = primaryMuscle ? (MUSCLE_ICONS[primaryMuscle] ?? '🏋️') : '🏋️';

  const diffLevel = difficulty === 'Beginner' ? 1 : difficulty === 'Intermediate' ? 2 : difficulty === 'Advanced' ? 3 : 0;
  const diffColor = difficulty === 'Beginner' ? 'var(--green)' : difficulty === 'Intermediate' ? 'var(--orange)' : difficulty === 'Advanced' ? 'var(--red)' : 'var(--text4)';

  return (
    <div
      className={cn(
        'group/ex flex items-center gap-2 py-2 pl-2 pr-3 select-none transition-colors hover:bg-bg-hover',
        isOpen && 'border-b border-border',
      )}
      onClick={onToggle}
    >
      {/* Muscle-group icon */}
      <span className="text-[18px] leading-none shrink-0" aria-hidden="true">{muscleIcon}</span>

      <span
        className={cn(
          'text-[10px] text-text3 transition-transform duration-150 w-3 inline-flex items-center justify-center shrink-0',
          isOpen && 'rotate-90',
        )}
      >
        ▶
      </span>

      {/* Name + badge + summary */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-text truncate">
          {exercise.exerciseName}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {muscleGroups.map((g) => (
            <span
              key={g}
              className="text-[10px] font-medium rounded-sm px-1.5 py-[1px]"
              style={{
                background: MUSCLE_BG_COLORS[g] ?? 'var(--accent-bg)',
                color: MUSCLE_COLORS[g] ?? 'var(--accent)',
              }}
            >
              {t(`training.muscle${g}`)}
            </span>
          ))}
          <span className="text-[11px] text-text3 tabular-nums">
            {summaryText ??
              (isWod
                ? `${repsStr ?? '–'} · ${weightStr ?? '–'} kg`
                : `${setsCount ?? 0}×${repsStr ?? '–'} · ${weightStr ?? '–'} kg`)}
          </span>
          {exerciseCompletionState !== undefined && exerciseCounts !== undefined && (
            <CompletionBadge
              kind="exercise"
              state={exerciseCompletionState}
              counts={exerciseCounts}
            />
          )}
        </div>
      </div>

      {/* Difficulty bar + Total volume */}
      <div className="flex items-center gap-2 shrink-0">
        {diffLevel > 0 && (
          <div className="flex items-center gap-[3px]">
            {[1, 2, 3].map((level) => (
              <div
                key={level}
                className="rounded-full"
                style={{
                  width: 14,
                  height: 4,
                  background: level <= diffLevel ? diffColor : 'var(--bg3)',
                }}
              />
            ))}
          </div>
        )}
        {totalVolume > 0 && (
          <span className="text-[12px] text-accent font-semibold tabular-nums">
            {totalVolume.toLocaleString()} kg
          </span>
        )}
      </div>

      {/* Actions — hover visible. Both buttons mirror the SectionCard
          header pattern: `disabled` prevents the click handler from
          firing, `cursor: not-allowed` + `opacity: 0.4` give a clear
          visual cue when the row is read-only (finished exercise,
          finished session, day-in-past). */}
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onDuplicate}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '2px 4px',
            fontSize: 11,
            color: 'var(--text4)',
            borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
            opacity: disabled ? 0.4 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.color = 'var(--text2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text4)';
          }}
          title={t('training.duplicateExercise')}
        >
          ⧉
        </button>
        <button
          onClick={onRemove}
          disabled={disabled}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '2px 4px',
            fontSize: 11,
            color: 'var(--text4)',
            borderRadius: 'var(--radius)',
            transition: 'color 0.1s',
            opacity: disabled ? 0.4 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.color = 'var(--red)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text4)';
          }}
          title={t('training.removeExercise')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
