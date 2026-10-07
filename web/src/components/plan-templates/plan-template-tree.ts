import {
  MealKind,
  PrimaryGoal,
  type NutritionPlanTemplateWeekRequest,
} from '@/api/nutrition-plan-templates';

/** Days in a template week, Monday (1) to Sunday (7). */
const DAYS_PER_WEEK = 7;

export interface MealSlot {
  kind: MealKind;
  /** i18n key under `planTemplates.slots`. */
  labelKey: string;
}

/** The five meal-slot chips, in the order the New template board shows them. */
export const MEAL_SLOTS: readonly MealSlot[] = [
  { kind: MealKind.Breakfast, labelKey: 'breakfast' },
  { kind: MealKind.MorningSnack, labelKey: 'snack' },
  { kind: MealKind.Lunch, labelKey: 'lunch' },
  { kind: MealKind.Dinner, labelKey: 'dinner' },
  { kind: MealKind.AfternoonSnack, labelKey: 'snack2' },
];

/** Slots in the order a day's meals run; this is the order sent to the API. */
const CHRONOLOGICAL_KINDS: readonly MealKind[] = [
  MealKind.Breakfast,
  MealKind.MorningSnack,
  MealKind.Lunch,
  MealKind.AfternoonSnack,
  MealKind.Dinner,
];

export const DEFAULT_MEAL_KINDS: readonly MealKind[] = [
  MealKind.Breakfast,
  MealKind.MorningSnack,
  MealKind.Lunch,
  MealKind.Dinner,
];

export const MIN_WEEKS = 1;
export const MAX_WEEKS = 52;

/**
 * Builds the empty week tree sent on create: `weekCount` weeks of 7 days, each
 * holding one empty meal per chosen kind in chronological order.
 */
export function buildTemplateWeeks(weekCount: number, kinds: readonly MealKind[]): NutritionPlanTemplateWeekRequest[] {
  const orderedKinds = CHRONOLOGICAL_KINDS.filter((kind) => kinds.includes(kind));
  return Array.from({ length: weekCount }, (_, weekIndex) => ({
    weekNumber: weekIndex + 1,
    days: Array.from({ length: DAYS_PER_WEEK }, (_, dayIndex) => ({
      dayOfWeek: dayIndex + 1,
      meals: orderedKinds.map((kind, mealIndex) => ({ kind, order: mealIndex + 1, foods: [], recipes: [] })),
    })),
  }));
}

interface GoalStyle {
  /** Tailwind background class of the goal's colour dot. */
  dotClass: string;
}

/** Goal dot colours: existing macro/brand tokens, matching the Plan templates boards. */
export const GOAL_STYLES: Record<PrimaryGoal, GoalStyle> = {
  [PrimaryGoal.LoseFat]: { dotClass: 'bg-training' },
  [PrimaryGoal.GainMuscle]: { dotClass: 'bg-macro-protein' },
  [PrimaryGoal.Maintain]: { dotClass: 'bg-nutrition' },
  [PrimaryGoal.Performance]: { dotClass: 'bg-macro-carbs' },
  [PrimaryGoal.Recomposition]: { dotClass: 'bg-macro-fat' },
  [PrimaryGoal.Fitness]: { dotClass: 'bg-macro-fibre' },
  [PrimaryGoal.Health]: { dotClass: 'bg-nutrition-bright' },
};

/** All seven goals, board order first. */
export const GOAL_ORDER: readonly PrimaryGoal[] = [
  PrimaryGoal.LoseFat,
  PrimaryGoal.GainMuscle,
  PrimaryGoal.Maintain,
  PrimaryGoal.Performance,
  PrimaryGoal.Recomposition,
  PrimaryGoal.Fitness,
  PrimaryGoal.Health,
];
