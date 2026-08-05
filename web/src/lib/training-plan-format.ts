import type {
  MovementType,
  WorkoutFormat,
  WodConfig,
} from '@/api/training-plan-types';

/**
 * Structural subset of a planned-or-logged set that the summary
 * formatter needs. Loose enough to accept both `ExerciseSet`
 * (training-plan editor model) and `SetDto` (generated API model).
 */
interface SummarySet {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
}

/**
 * Estimated total wall-clock duration of a section in seconds, derived from
 * the section's format and `formatConfig`.
 *
 *   AMRAP / ForTime → time cap (the cap IS the duration; clients may finish earlier in ForTime)
 *   EMOM            → interval × rounds
 *   Tabata          → (work + rest) × rounds
 *   Standard        → not derivable (depends on per-set rest + perceived effort)
 *
 * Returns `null` when the relevant fields are missing or the format is Standard.
 */
export function estimatedSectionDurationSeconds(
  format: WorkoutFormat,
  cfg: WodConfig | null | undefined,
): number | null {
  if (!cfg) return null;
  switch (format) {
    case 'AMRAP':
    case 'ForTime':
      return cfg.timeCapSeconds ?? null;
    case 'EMOM':
      return cfg.intervalSeconds != null && cfg.totalRounds
        ? cfg.intervalSeconds * cfg.totalRounds
        : null;
    case 'Tabata':
      return cfg.workSeconds != null && cfg.restSeconds != null && cfg.totalRounds
        ? (cfg.workSeconds + cfg.restSeconds) * cfg.totalRounds
        : null;
    default:
      return null;
  }
}

/**
 * Format a duration in seconds as a compact human label:
 *   < 60s         → `45 s`
 *   whole minutes → `12 min`
 *   mixed         → `4 min 30 s`
 */
export function formatDurationCompact(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} s`;
}

/**
 * Min–max range of a numeric field across an array of sets, formatted for
 * the exercise-card summary line. Examples:
 *   - All present + identical → `12`
 *   - All present + range     → `15-22.5`
 *   - Mixed / all null        → `–`
 */
function rangeStr(values: (number | null | undefined)[]): string {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return '–';
  const min = Math.min(...present);
  const max = Math.max(...present);
  return min === max ? `${min}` : `${min}-${max}`;
}

/**
 * Same as `rangeStr` but each end runs through `formatDurationCompact`
 * so a 900 s value renders as `15 min`, 90 s as `1 min 30 s`, etc.
 * Returns the unit suffix already attached — callers should NOT add
 * ` s` after it.
 */
function durationRangeStr(values: (number | null | undefined)[]): string {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return '–';
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (min === max) return formatDurationCompact(min);
  return `${formatDurationCompact(min)} – ${formatDurationCompact(max)}`;
}

/**
 * Compact summary of an exercise's prescription for the card header
 * (e.g. "4×4-10 · 15-22.5 kg", "40 s · 10 kg", "30 m · 40 s · 10 kg").
 *
 * Branches on `movementType`:
 *   - `Reps` / null / undefined → `{setCount?}×{repsRange} · {weightRange} kg`
 *   - `Time`                    → `{setCount?}×{durationRange} s · {weightRange} kg`
 *   - `Distance`                → `{setCount?}×{distanceRange} m · {durationRange} s · {weightRange} kg`
 *   - `RepsForTime`             → `{setCount?}×{repsRange} · {durationRange} s`
 *
 * `isWod` drops the leading `{setCount}×` prefix because WOD sections
 * store one row that holds the round prescription — set-count math
 * isn't meaningful.
 */
export function formatExerciseSummary(
  sets: SummarySet[],
  movementType: MovementType | null | undefined,
  isWod: boolean,
): string {
  if (sets.length === 0) return '';
  const setCount = sets.length;
  const reps = rangeStr(sets.map((s) => s.reps));
  const weight = rangeStr(sets.map((s) => s.weightKg));
  // Duration uses `formatDurationCompact` so 900 s renders as "15 min",
  // 90 s as "1 min 30 s", < 60 s as "45 s". The unit suffix is already
  // baked into the returned string.
  const duration = durationRangeStr(sets.map((s) => s.durationSeconds));
  const distance = rangeStr(sets.map((s) => s.distanceMeters));

  const mt: MovementType = movementType ?? 'Reps';
  const withCount = (core: string) => (isWod ? core : `${setCount}×${core}`);
  // No weight prescribed → render the universal "BW" (bodyweight) marker
  // instead of "– kg". Matches gym-log conventions and reads cleaner on
  // exercises where load truly doesn't apply (push-ups, plank, etc.).
  const weightLabel = weight === '–' ? 'BW' : `${weight} kg`;

  switch (mt) {
    case 'Time':
      return `${withCount(duration)} · ${weightLabel}`;
    case 'Distance':
      return `${withCount(`${distance} m`)} · ${duration} · ${weightLabel}`;
    case 'RepsForTime':
      return `${withCount(reps)} · ${duration}`;
    case 'Reps':
    default:
      return `${withCount(reps)} · ${weightLabel}`;
  }
}
