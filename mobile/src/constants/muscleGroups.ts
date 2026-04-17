import type { MuscleGroup } from '@/api/training'
import type { ColorScheme } from '@/constants/colors'

/**
 * Maps each MuscleGroup enum value to the semantic color token key on the theme.
 * Mirrors the MUSCLE_GROUP_COLORS map in web/src/components/training/TrainingSidebar.tsx
 * so both clients use identical color semantics.
 */
export const MUSCLE_GROUP_COLOR_TOKEN: Record<
  MuscleGroup,
  'blue' | 'green' | 'orange' | 'purple' | 'gold'
> = {
  Chest: 'blue',
  Back: 'green',
  Shoulders: 'orange',
  Biceps: 'purple',
  Triceps: 'purple',
  Forearms: 'purple',
  Quadriceps: 'blue',
  Hamstrings: 'blue',
  Glutes: 'green',
  Calves: 'green',
  Abs: 'orange',
  Obliques: 'orange',
  LowerBack: 'orange',
  Traps: 'green',
  FullBody: 'gold',
}

export function getMuscleGroupColor(mg: MuscleGroup, colors: ColorScheme): string {
  return colors[MUSCLE_GROUP_COLOR_TOKEN[mg]]
}
