import { useTranslation } from 'react-i18next';
import type {
  PublicSessionTemplateResponse,
  TrainingWorkout as GenTrainingWorkout,
  SessionExercise as GenSessionExercise,
} from '@/api/generated';
import type { WorkoutFormat as WorkoutFormatType, WodConfig, MovementType as MovementTypeType } from '@/api/training-plan-types';
import { Dialog } from '@/components/ui/Dialog';
import { FORMAT_LABEL_KEYS, FORMAT_BG_COLORS, FORMAT_COLORS } from '@/constants/training';
import {
  estimatedSectionDurationSeconds,
  formatDurationCompact,
  formatExerciseSummary,
  resolveLocalizedTemplateName,
} from '@/lib/training-plan-format';

interface PublicSessionTemplateDetailDialogProps {
  open: boolean;
  template: PublicSessionTemplateResponse | null;
  onClose: () => void;
}

/** Small colored pill showing a workout/session-level workout format. */
function FormatBadge({ format }: { format: WorkoutFormatType }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: FORMAT_BG_COLORS[format], color: FORMAT_COLORS[format] }}
    >
      {t(`training.format.${FORMAT_LABEL_KEYS[format]}`)}
    </span>
  );
}

/**
 * Read-only summary of a workout's format config (e.g. "Cap 20 min",
 * "60 s × 10 rounds", "20 s / 10 s × 8 rounds"). Returns null for Standard
 * workouts or when the estimated duration can't be derived.
 */
function useFormatConfigSummary(format: WorkoutFormatType, cfg: WodConfig | null | undefined): string | null {
  const { t } = useTranslation();
  const durationSeconds = estimatedSectionDurationSeconds(format, cfg);
  if (!cfg) return null;
  switch (format) {
    case 'AMRAP':
    case 'ForTime':
      return durationSeconds != null ? `${t('training.wod.timeCap')}: ${formatDurationCompact(durationSeconds)}` : null;
    case 'EMOM':
      return cfg.intervalSeconds != null && cfg.totalRounds
        ? `${t('training.wod.interval')} ${formatDurationCompact(cfg.intervalSeconds)} × ${cfg.totalRounds} ${t('training.wod.rounds')}`
        : null;
    case 'Tabata':
      return cfg.workSeconds != null && cfg.restSeconds != null && cfg.totalRounds
        ? `${formatDurationCompact(cfg.workSeconds)} / ${formatDurationCompact(cfg.restSeconds)} × ${cfg.totalRounds} ${t('training.wod.rounds')}`
        : null;
    default:
      return null;
  }
}

/** Read-only set-prescription table for a single exercise — shows only the columns that have data. */
function ExerciseSetsTable({ exercise }: { exercise: GenSessionExercise }) {
  const { t } = useTranslation();
  const sets = exercise.sets ?? [];
  if (sets.length === 0) return null;

  const showReps = sets.some((s) => s.reps != null);
  const showWeight = sets.some((s) => s.weightKg != null);
  const showDuration = sets.some((s) => s.durationSeconds != null);
  const showDistance = sets.some((s) => s.distanceMeters != null);
  const showRest = sets.some((s) => s.restSeconds != null);

  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="text-[10px] font-medium uppercase tracking-wider text-text3">
          <th className="px-1 py-1 w-7 text-center">#</th>
          {showReps && <th className="px-1 py-1 text-center">{t('training.repsLabel')}</th>}
          {showWeight && <th className="px-1 py-1 text-center">{t('training.weightLabel')}</th>}
          {showDuration && <th className="px-1 py-1 text-center">{t('training.wod.durationLabel')}</th>}
          {showDistance && <th className="px-1 py-1 text-center">{t('training.wod.distanceLabel')}</th>}
          {showRest && <th className="px-1 py-1 text-center">{t('training.restSecondsLabel')}</th>}
        </tr>
      </thead>
      <tbody>
        {sets.map((s, idx) => (
          <tr key={s.setNumber ?? idx}>
            <td className="px-1 py-1 text-center text-text3 tabular-nums">{s.setNumber ?? idx + 1}</td>
            {showReps && <td className="px-1 py-1 text-center tabular-nums">{s.reps ?? '–'}</td>}
            {showWeight && <td className="px-1 py-1 text-center tabular-nums">{s.weightKg ?? '–'}</td>}
            {showDuration && <td className="px-1 py-1 text-center tabular-nums">{s.durationSeconds ?? '–'}</td>}
            {showDistance && <td className="px-1 py-1 text-center tabular-nums">{s.distanceMeters ?? '–'}</td>}
            {showRest && <td className="px-1 py-1 text-center tabular-nums">{s.restSeconds ?? '–'}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExerciseRow({ exercise, isWod }: { exercise: GenSessionExercise; isWod: boolean }) {
  const movementType = (exercise.movementType ?? 'Reps') as MovementTypeType;
  const summary = formatExerciseSummary(exercise.sets ?? [], movementType, isWod);

  return (
    <div className="rounded-md border border-border bg-bg overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border bg-bg2">
        <span className="flex-1 truncate text-[13px] font-semibold text-text">
          {exercise.exerciseName}
        </span>
        {summary && <span className="text-[11px] text-text3 tabular-nums shrink-0">{summary}</span>}
      </div>
      {exercise.notes && (
        <div className="px-2.5 pt-1.5 text-[12px] italic text-text3">{exercise.notes}</div>
      )}
      <div className="px-2 py-1.5">
        <ExerciseSetsTable exercise={exercise} />
      </div>
    </div>
  );
}

function WorkoutBlock({ workout }: { workout: GenTrainingWorkout }) {
  const { t } = useTranslation();
  const format = ((workout.format ?? 'Standard') as WorkoutFormatType);
  const isWod = format !== 'Standard';
  const configSummary = useFormatConfigSummary(format, workout.formatConfig);

  return (
    <div className="rounded-md border border-border-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-bg2">
        <span className="flex-1 truncate text-[13px] font-semibold text-text">{workout.name}</span>
        {format !== 'Standard' && <FormatBadge format={format} />}
        {configSummary && <span className="text-[11px] text-text3 shrink-0">{configSummary}</span>}
      </div>
      {workout.notes && (
        <div className="px-3 pt-2 text-[12px] italic text-text3">{workout.notes}</div>
      )}
      <div className="flex flex-col gap-2 p-2.5">
        {(workout.exercises ?? []).length === 0 ? (
          <p className="text-[12px] text-text3">{t('training.template.noExercisesHint')}</p>
        ) : (
          (workout.exercises ?? []).map((ex, idx) => (
            <ExerciseRow key={`${ex.exerciseExternalId}-${idx}`} exercise={ex} isWod={isWod} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Read-only detail dialog for a public session template — renders the full
 * workouts -> exercises -> sets hierarchy embedded in the list response
 * (no second call). Used from the "Template library" section on the
 * section-templates page.
 */
export function PublicSessionTemplateDetailDialog({
  open,
  template,
  onClose,
}: PublicSessionTemplateDetailDialogProps) {
  const { t, i18n } = useTranslation();

  if (!template) return null;

  const format = ((template.format ?? 'Standard') as WorkoutFormatType);
  const displayName = resolveLocalizedTemplateName(template.name ?? '', template.localizedNames, i18n.language);
  const workouts = template.workouts ?? [];

  return (
    <Dialog open={open} onClose={onClose} title={displayName} maxWidth={640}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <FormatBadge format={format} />
          {template.difficulty && (
            <span className="text-[11px] text-text3">{t(`enums.difficulty.${template.difficulty}`)}</span>
          )}
          {template.estimatedDurationMinutes != null && (
            <span className="text-[11px] text-text3">
              {t('training.template.library.durationMinutes', { count: template.estimatedDurationMinutes })}
            </span>
          )}
        </div>

        {template.description && (
          <div>
            <p className="mb-1 text-xs font-medium text-text3">{t('training.template.library.descriptionLabel')}</p>
            <p className="text-[13px] text-text2">{template.description}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {workouts
            .slice()
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((workout, idx) => (
              <WorkoutBlock key={workout.workoutId ?? idx} workout={workout} />
            ))}
        </div>
      </div>
    </Dialog>
  );
}
