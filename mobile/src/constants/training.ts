import type { WorkoutFormat } from '@/api/training';
import type { ColorScheme } from '@/constants/colors';

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

/**
 * Returns the saturated text color for a format chip from the active theme.
 *
 * Mapping (mirrors `FORMAT_COLORS` / `FORMAT_BG_COLORS` on the web):
 *   Standard → colors.label3 (neutral)
 *   AMRAP    → colors.orange
 *   EMOM     → colors.purple
 *   Tabata   → colors.red
 *   ForTime  → colors.blue
 *
 * All values come from the theme — never hardcoded hex.
 */
export function formatChipColor(
  format: WorkoutFormat | null | undefined,
  colors: ColorScheme,
): string {
  switch (format) {
    case 'AMRAP':
      return colors.orange;
    case 'EMOM':
      return colors.purple;
    case 'Tabata':
      return colors.red;
    case 'ForTime':
      return colors.blue;
    case 'Standard':
    default:
      return colors.label3;
  }
}

/**
 * Returns the soft background color for a format chip (8% alpha tint).
 *
 * Derives from the same mapping as `formatChipColor`:
 *   Standard → colors.fill2
 *   AMRAP    → colors.orange + '14'  (~8% alpha)
 *   EMOM     → colors.purple + '14'
 *   Tabata   → colors.red + '14'
 *   ForTime  → colors.blue + '14'
 *
 * '14' = 20 in decimal ≈ 8% opacity (consistent with muscle-group chips).
 */
export function formatChipBg(
  format: WorkoutFormat | null | undefined,
  colors: ColorScheme,
): string {
  switch (format) {
    case 'AMRAP':
      return colors.orange + '14';
    case 'EMOM':
      return colors.purple + '14';
    case 'Tabata':
      return colors.red + '14';
    case 'ForTime':
      return colors.blue + '14';
    case 'Standard':
    default:
      return colors.fill2;
  }
}
