import type { WorkoutFormat } from '@/api/training-plan-types';

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * i18n key suffix per WorkoutFormat — explicit so all-caps acronyms (AMRAP, EMOM)
 * don't break under naive `firstChar.toLowerCase()` transforms.
 * Matches the keys under `training.format.*` in the locale files.
 */
export const FORMAT_LABEL_KEYS: Record<WorkoutFormat, string> = {
  Standard: 'standard',
  ForTime: 'forTime',
  AMRAP: 'amrap',
  EMOM: 'emom',
  Tabata: 'tabata',
};

/**
 * Format chip colors — text color (saturated) used inline. Mirrors the
 * muscle-group chip styling on the training-plan detail page so the two
 * chip families look like one system.
 */
export const FORMAT_COLORS: Record<WorkoutFormat, string> = {
  Standard: 'var(--text3)',
  AMRAP:    'var(--orange)',
  EMOM:     'var(--purple)',
  Tabata:   'var(--red)',
  ForTime:  'var(--blue)',
};

/**
 * Format chip background colors — soft 8% alpha tones from the design system.
 * Pair with `FORMAT_COLORS` via inline `style={{ background, color }}`.
 */
export const FORMAT_BG_COLORS: Record<WorkoutFormat, string> = {
  Standard: 'var(--bg2)',
  AMRAP:    'var(--orange-bg)',
  EMOM:     'var(--purple-bg)',
  Tabata:   'var(--red-bg)',
  ForTime:  'var(--blue-bg)',
};

export const MUSCLE_ICONS: Record<string, string> = {
  Chest: '🫁', Back: '🔙', Shoulders: '🏔️', Biceps: '💪', Triceps: '💪',
  Forearms: '🦾', Quadriceps: '🦵', Hamstrings: '🦵', Glutes: '🍑', Calves: '🦶',
  Abs: '🧱', Obliques: '🧱', LowerBack: '🔙', Traps: '🏔️', FullBody: '🏋️',
};

export const MUSCLE_COLORS: Record<string, string> = {
  Chest: 'var(--blue)', Back: 'var(--green)', Shoulders: 'var(--orange)', Biceps: 'var(--purple)', Triceps: 'var(--purple)',
  Forearms: 'var(--purple)', Quadriceps: 'var(--blue)', Hamstrings: 'var(--blue)', Glutes: 'var(--green)', Calves: 'var(--green)',
  Abs: 'var(--orange)', Obliques: 'var(--orange)', LowerBack: 'var(--orange)', Traps: 'var(--green)', FullBody: 'var(--accent)',
};

export const MUSCLE_BG_COLORS: Record<string, string> = {
  Chest: 'var(--blue-bg)', Back: 'var(--green-bg)', Shoulders: 'var(--orange-bg)', Biceps: 'var(--purple-bg)', Triceps: 'var(--purple-bg)',
  Forearms: 'var(--purple-bg)', Quadriceps: 'var(--blue-bg)', Hamstrings: 'var(--blue-bg)', Glutes: 'var(--green-bg)', Calves: 'var(--green-bg)',
  Abs: 'var(--orange-bg)', Obliques: 'var(--orange-bg)', LowerBack: 'var(--orange-bg)', Traps: 'var(--green-bg)', FullBody: 'var(--accent-bg)',
};
