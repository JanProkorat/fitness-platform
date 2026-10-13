import type { NutritionPlanDetail, PlanMeal } from '@/api/plan-types';
import { macrosForAmount, sumMacros, type Macros } from '@/lib/recipe-nutrition';
import {
  addDays,
  currentWeekNumber,
  parseCalendarDate,
} from '@/components/client-detail/nutrition/nutritionPlanView';

const DAYS_PER_WEEK = 7;
/** A finished day whose eaten share is below this is flagged as a low day. */
export const LOW_DAY_RATIO = 0.6;
/** A by-meal row whose eaten share is below this is flagged and carries the skipped note. */
export const FLAGGED_ROW_RATIO = 0.75;

export type MealGroup = 'breakfast' | 'snack' | 'lunch' | 'dinner';

/** Display order of the by-meal rows. */
export const MEAL_GROUPS: MealGroup[] = ['breakfast', 'snack', 'lunch', 'dinner'];

export type DayTileState = 'past' | 'today' | 'future';

export interface DayTile {
  date: Date;
  state: DayTileState;
  planned: number;
  eaten: number;
  /** A finished day with planned meals and an eaten share below `LOW_DAY_RATIO`. */
  low: boolean;
}

export interface MealGroupRow {
  group: MealGroup;
  planned: number;
  eaten: number;
  skipped: number;
  /** The row's eaten share is below `FLAGGED_ROW_RATIO`. */
  flagged: boolean;
  note: 'always' | 'skipped' | undefined;
}

export interface MacroAverages {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type ThisWeekStatus = 'ready' | 'notScheduled' | 'notStarted' | 'noWeek' | 'noData';

export interface ThisWeekModel {
  status: ThisWeekStatus;
  planStart?: Date;
  weekNumber?: number;
  tiles: DayTile[];
  /** Planned meals on finished days (today excluded). */
  planned: number;
  /** Meals ticked as eaten on finished days. */
  eaten: number;
  percent: number;
  /** First and last finished day of the week, when there is one. */
  loggedFrom?: Date;
  loggedTo?: Date;
  rows: MealGroupRow[];
  /** Eaten macros averaged over finished days that had planned meals. */
  averages: MacroAverages;
  targets: { kcal?: number; protein?: number; carbs?: number; fat?: number };
}

const EMPTY_AVERAGES: MacroAverages = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Row a meal kind counts toward; workout meals and unknown kinds count as snacks. */
export function mealGroup(kind: string): MealGroup {
  switch (kind) {
    case 'Breakfast':
      return 'breakfast';
    case 'Lunch':
      return 'lunch';
    case 'Dinner':
      return 'dinner';
    default:
      return 'snack';
  }
}

/** A meal's macros: the stored totals, else summed from its foods and recipes. */
export function mealMacros(meal: PlanMeal): Macros {
  const totals = meal.mealTotals;
  if (totals) {
    return { kcal: totals.kcal, protein: totals.protein, carbs: totals.carbs, fat: totals.fat };
  }
  const fromFoods = meal.foods.map((food) => {
    const { kcal, protein, carbs, fat } = food.nutrientValuePer100Grams;
    return macrosForAmount({ kcal, protein, carbs, fat }, food.amountGrams);
  });
  const fromRecipes = (meal.recipes ?? []).map((recipe) => ({
    kcal: recipe.nutrientValuePerServing.kcal * recipe.servings,
    protein: recipe.nutrientValuePerServing.protein * recipe.servings,
    carbs: recipe.nutrientValuePerServing.carbs * recipe.servings,
    fat: recipe.nutrientValuePerServing.fat * recipe.servings,
  }));
  return sumMacros([...fromFoods, ...fromRecipes]);
}

function positive(value: number | null | undefined): number | undefined {
  return value && value > 0 ? value : undefined;
}

function emptyModel(status: ThisWeekStatus, plan: NutritionPlanDetail, partial: Partial<ThisWeekModel> = {}): ThisWeekModel {
  return {
    status,
    tiles: [],
    planned: 0,
    eaten: 0,
    percent: 0,
    rows: [],
    averages: EMPTY_AVERAGES,
    targets: targetsOf(plan),
    ...partial,
  };
}

function targetsOf(plan: NutritionPlanDetail): ThisWeekModel['targets'] {
  const settings = plan.globalSettings;
  return {
    kcal: positive(settings?.dailyKcal),
    protein: positive(settings?.proteinGrams),
    carbs: positive(settings?.carbsGrams),
    fat: positive(settings?.fatGrams),
  };
}

/** Adherence for the plan week `today` falls in, computed from the plan's meals and meal logs. */
export function buildThisWeek(plan: NutritionPlanDetail, today: Date): ThisWeekModel {
  const planStart = parseCalendarDate(plan.startDate);
  if (!planStart) {
    return emptyModel('notScheduled', plan);
  }
  const weekNumber = currentWeekNumber(planStart, today);
  if (weekNumber === undefined || weekNumber < 1) {
    return emptyModel('notStarted', plan, { planStart });
  }
  const week = plan.weeks.find((w) => w.weekNumber === weekNumber);
  if (!week) {
    return emptyModel('noWeek', plan, { planStart, weekNumber });
  }

  const weekStart = addDays(planStart, (weekNumber - 1) * DAYS_PER_WEEK);
  const eatenKeys = new Set(
    (plan.mealLogs ?? []).filter((log) => log.isEaten).map((log) => `${log.mealId}|${log.logDate.slice(0, 10)}`),
  );

  const tiles: DayTile[] = [];
  const groupTotals: Record<MealGroup, { planned: number; eaten: number }> = {
    breakfast: { planned: 0, eaten: 0 },
    snack: { planned: 0, eaten: 0 },
    lunch: { planned: 0, eaten: 0 },
    dinner: { planned: 0, eaten: 0 },
  };
  const eatenMacros: Macros[] = [];
  let planned = 0;
  let eaten = 0;
  let countedDays = 0;
  let loggedFrom: Date | undefined;
  let loggedTo: Date | undefined;

  for (let dayOfWeek = 1; dayOfWeek <= DAYS_PER_WEEK; dayOfWeek += 1) {
    const date = addDays(weekStart, dayOfWeek - 1);
    const meals = week.days.find((d) => d.dayOfWeek === dayOfWeek)?.meals ?? [];
    const state: DayTileState =
      date.getTime() < today.getTime() ? 'past' : date.getTime() === today.getTime() ? 'today' : 'future';
    const iso = isoDate(date);
    const eatenMeals = meals.filter((meal) => eatenKeys.has(`${meal.mealId}|${iso}`));
    const low = state === 'past' && meals.length > 0 && eatenMeals.length / meals.length < LOW_DAY_RATIO;
    tiles.push({ date, state, planned: meals.length, eaten: eatenMeals.length, low });

    if (state === 'past' && meals.length > 0) {
      countedDays += 1;
      planned += meals.length;
      eaten += eatenMeals.length;
      loggedFrom ??= date;
      loggedTo = date;
      for (const meal of meals) {
        groupTotals[mealGroup(meal.kind)].planned += 1;
      }
      for (const meal of eatenMeals) {
        groupTotals[mealGroup(meal.kind)].eaten += 1;
        eatenMacros.push(mealMacros(meal));
      }
    }
  }

  const targets = targetsOf(plan);
  if (countedDays === 0) {
    return { ...emptyModel('noData', plan, { planStart, weekNumber }), tiles };
  }

  const totals = sumMacros(eatenMacros);
  const rows = MEAL_GROUPS.filter((group) => groupTotals[group].planned > 0).map((group): MealGroupRow => {
    const { planned: rowPlanned, eaten: rowEaten } = groupTotals[group];
    const skipped = rowPlanned - rowEaten;
    const flagged = rowEaten / rowPlanned < FLAGGED_ROW_RATIO;
    return {
      group,
      planned: rowPlanned,
      eaten: rowEaten,
      skipped,
      flagged,
      note: flagged ? 'skipped' : skipped === 0 ? 'always' : undefined,
    };
  });

  return {
    status: 'ready',
    planStart,
    weekNumber,
    tiles,
    planned,
    eaten,
    percent: Math.round((eaten / planned) * 100),
    loggedFrom,
    loggedTo,
    rows,
    averages: {
      kcal: totals.kcal / countedDays,
      protein: totals.protein / countedDays,
      carbs: totals.carbs / countedDays,
      fat: totals.fat / countedDays,
    },
    targets,
  };
}

/** Short weekday name for a calendar date (UTC midnight) in the given language. */
export function formatWeekday(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
}
