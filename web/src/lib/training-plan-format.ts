import type { WorkoutFormat, WodConfig } from '@/api/training-plan-types';

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
