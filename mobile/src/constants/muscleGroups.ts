import type { MuscleGroup } from '@/api/training'

/**
 * Maps each MuscleGroup enum value to the semantic color token key on the theme.
 * Mirrors the MUSCLE_GROUP_COLORS map in web/src/components/training/TrainingSidebar.tsx
 * so both clients use identical color semantics.
 *
 * This is the domain mapping only (muscle group → semantic slot name) — kept
 * as reusable data. `getMuscleGroupColor`, which resolved the slot against a
 * live `ColorScheme` from the now-deleted `constants/colors.ts`, was dropped
 * as part of the clean-slate UI redesign; the new design system will need
 * its own resolver against its own token shape.
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
