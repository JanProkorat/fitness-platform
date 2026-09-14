/**
 * Shared animation constants for the training-card collapse/expand stack.
 *
 * Consumed by:
 *   - ExpandableExerciseCard (exercise-level collapse)
 *   - ExpandableSessionCard (session-level collapse)
 *   - TrainingCard / SessionSectionList (section-level collapse)
 *   - SectionHeader (chevron rotation)
 *
 * All three levels use the same duration so that the chevron rotation and
 * the content collapse finish in lockstep.
 *
 * `trainingLayoutTransition` has been removed — the stack now uses
 * `AnimatedCollapse` (the same measured-height pattern as MealCard) instead
 * of `LinearTransition`.
 */
import { Easing } from 'react-native-reanimated'
import { ANIM_DURATION, ANIM_EASING } from './AnimatedCollapse'

/** Duration in ms — aliased from AnimatedCollapse so all levels stay in sync. */
export const TRAINING_ANIM_DURATION = ANIM_DURATION

/** Easing function — aliased from AnimatedCollapse for the chevron rotation. */
export const trainingEasing = ANIM_EASING

// Re-export Easing so importers that used to get it from here still compile.
export { Easing }
