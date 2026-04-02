export type MealKind = 'Breakfast' | 'MorningSnack' | 'Lunch' | 'AfternoonSnack' | 'Dinner' | 'PreWorkout' | 'PostWorkout';

export const MEAL_KINDS: MealKind[] = ['Breakfast', 'MorningSnack', 'Lunch', 'AfternoonSnack', 'Dinner', 'PreWorkout', 'PostWorkout'];

export const MEAL_KIND_CONFIG: Record<MealKind, { icon: string; color: string }> = {
  Breakfast:      { icon: '🌅', color: 'var(--orange)' },
  MorningSnack:   { icon: '🍎', color: 'var(--green)' },
  Lunch:          { icon: '🍽️', color: 'var(--blue)' },
  AfternoonSnack: { icon: '🥜', color: 'var(--purple)' },
  Dinner:         { icon: '🌙', color: '#6366f1' },
  PreWorkout:     { icon: '⚡', color: 'var(--orange)' },
  PostWorkout:    { icon: '💪', color: 'var(--green)' },
};
