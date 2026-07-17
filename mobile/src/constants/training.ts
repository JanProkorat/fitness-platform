import type { WorkoutFormat } from '@/api/training';

/**
 * Maps each WorkoutFormat to its i18n key suffix under `training.format.*`.
 *
 * Using an explicit map prevents naive `.toLowerCase()` transforms from
 * producing the wrong key for multi-word formats like `ForTime` (which maps
 * to `forTime`, not `fortime`).
 *
 * Mirrors `FORMAT_LABEL_KEYS` in `web/src/constants/training.ts`.
 */
export const FORMAT_LABEL_KEYS: Record<WorkoutFormat, string> = {
  Standard: 'standard',
  ForTime: 'forTime',
  AMRAP: 'amrap',
  EMOM: 'emom',
  Tabata: 'tabata',
};

// NOTE: `formatChipColor` / `formatChipBg` used to live here, mapping a
// WorkoutFormat to theme colors (`ColorScheme` from the now-deleted
// `constants/colors.ts`). They were presentation helpers, not domain data,
// so they were dropped as part of the clean-slate UI redesign rather than
// severed — the new design system will need its own chip-color mapping
// against its own token shape.
