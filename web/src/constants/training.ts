export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

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
