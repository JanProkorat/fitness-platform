import { create } from 'zustand';
import type {
  NutritionPlanDetail,
  PlanMeal,
  MealFood,
  NutrientTotals,
  UpdatePlanRequest,
} from '@/api/plan-types';
import { updatePlan as apiUpdatePlan, publishWeek as apiPublishWeek, getPlan } from '@/api/plans';

interface NutritionPlanState {
  plan: NutritionPlanDetail | null;
  isDirty: boolean;
  isSaving: boolean;
  selectedWeek: number;
  setPlan: (plan: NutritionPlanDetail) => void;
  setSelectedWeek: (week: number) => void;
  updateFoodAmount: (
    weekNum: number,
    dayOfWeek: number,
    mealId: string,
    foodExternalId: string,
    amountGrams: number,
  ) => void;
  addFoodToMeal: (weekNum: number, dayOfWeek: number, mealId: string, food: MealFood) => void;
  removeFoodFromMeal: (
    weekNum: number,
    dayOfWeek: number,
    mealId: string,
    foodExternalId: string,
  ) => void;
  addMeal: (weekNum: number, dayOfWeek: number, meal: PlanMeal) => void;
  removeMeal: (weekNum: number, dayOfWeek: number, mealId: string) => void;
  updateMealName: (weekNum: number, dayOfWeek: number, mealId: string, name: string) => void;
  reorderMeals: (weekNum: number, dayOfWeek: number, mealIds: string[]) => void;
  moveMealToDay: (
    weekNum: number,
    fromDayOfWeek: number,
    toDayOfWeek: number,
    mealId: string,
    targetIndex: number,
  ) => void;
  swapDays: (weekNum: number, fromDayOfWeek: number, toDayOfWeek: number) => void;
  addWeek: () => void;
  removeWeek: (weekNum: number) => void;
  save: () => Promise<void>;
  publishWeek: (weekNumber: number) => Promise<void>;
}

/** Calculate nutrient totals for a list of foods using Atwater factors. */
function calculateMealTotals(foods: MealFood[]): NutrientTotals {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const food of foods) {
    const scale = food.amountGrams / 100;
    const p = food.nutrientValuePer100Grams.protein * scale;
    const c = food.nutrientValuePer100Grams.carbs * scale;
    const f = food.nutrientValuePer100Grams.fat * scale;
    protein += p;
    carbs += c;
    fat += f;
    kcal += p * 4 + c * 4 + f * 9;
  }

  return {
    kcal: Math.round(kcal * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

/** Recalculate all meal and day totals in the plan. */
function recalculateTotals(plan: NutritionPlanDetail): NutritionPlanDetail {
  return {
    ...plan,
    weeks: plan.weeks.map((week) => ({
      ...week,
      days: week.days.map((day) => {
        const meals = day.meals.map((meal) => ({
          ...meal,
          mealTotals: calculateMealTotals(meal.foods),
        }));

        const dayTotals: NutrientTotals = {
          kcal: meals.reduce((sum, m) => sum + (m.mealTotals?.kcal ?? 0), 0),
          protein: meals.reduce((sum, m) => sum + (m.mealTotals?.protein ?? 0), 0),
          carbs: meals.reduce((sum, m) => sum + (m.mealTotals?.carbs ?? 0), 0),
          fat: meals.reduce((sum, m) => sum + (m.mealTotals?.fat ?? 0), 0),
        };

        return { ...day, meals, dayTotals };
      }),
    })),
  };
}

/** Helper: immutably update a specific day's meals within the plan. */
function updateDay(
  plan: NutritionPlanDetail,
  weekNum: number,
  dayOfWeek: number,
  updater: (meals: PlanMeal[]) => PlanMeal[],
): NutritionPlanDetail {
  return {
    ...plan,
    weeks: plan.weeks.map((week) =>
      week.weekNumber !== weekNum
        ? week
        : {
            ...week,
            days: week.days.map((day) =>
              day.dayOfWeek !== dayOfWeek
                ? day
                : { ...day, meals: updater(day.meals) },
            ),
          },
    ),
  };
}

export const useNutritionPlanStore = create<NutritionPlanState>((set, get) => ({
  plan: null,
  isDirty: false,
  isSaving: false,
  selectedWeek: 1,

  setPlan: (plan) => {
    set({ plan: recalculateTotals(plan), isDirty: false, selectedWeek: 1 });
  },

  setSelectedWeek: (week) => {
    set({ selectedWeek: week });
  },

  updateFoodAmount: (weekNum, dayOfWeek, mealId, foodExternalId, amountGrams) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId
          ? meal
          : {
              ...meal,
              foods: meal.foods.map((food) =>
                food.foodExternalId !== foodExternalId
                  ? food
                  : { ...food, amountGrams },
              ),
            },
      ),
    );

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  addFoodToMeal: (weekNum, dayOfWeek, mealId, food) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId
          ? meal
          : { ...meal, foods: [...meal.foods, food] },
      ),
    );

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  removeFoodFromMeal: (weekNum, dayOfWeek, mealId, foodExternalId) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId
          ? meal
          : {
              ...meal,
              foods: meal.foods.filter((f) => f.foodExternalId !== foodExternalId),
            },
      ),
    );

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  addMeal: (weekNum, dayOfWeek, meal) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) => [...meals, meal]);
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  removeMeal: (weekNum, dayOfWeek, mealId) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.filter((m) => m.mealId !== mealId),
    );
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  updateMealName: (weekNum, dayOfWeek, mealId, name) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      meals.map((meal) =>
        meal.mealId !== mealId ? meal : { ...meal, name },
      ),
    );
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  reorderMeals: (weekNum, dayOfWeek, mealIds) => {
    const { plan } = get();
    if (!plan) return;

    const updated = updateDay(plan, weekNum, dayOfWeek, (meals) =>
      mealIds
        .map((id, idx) => {
          const meal = meals.find((m) => m.mealId === id);
          return meal ? { ...meal, order: idx + 1 } : null;
        })
        .filter(Boolean) as PlanMeal[],
    );
    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  moveMealToDay: (weekNum, fromDayOfWeek, toDayOfWeek, mealId, targetIndex) => {
    const { plan } = get();
    if (!plan || fromDayOfWeek === toDayOfWeek) return;

    const week = plan.weeks.find((w) => w.weekNumber === weekNum);
    if (!week) return;

    const srcDay = week.days.find((d) => d.dayOfWeek === fromDayOfWeek);
    const meal = srcDay?.meals.find((m) => m.mealId === mealId);
    if (!meal) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((w) => {
        if (w.weekNumber !== weekNum) return w;
        return {
          ...w,
          days: w.days.map((day) => {
            if (day.dayOfWeek === fromDayOfWeek) {
              const remaining = day.meals
                .filter((m) => m.mealId !== mealId)
                .sort((a, b) => a.order - b.order)
                .map((m, i) => ({ ...m, order: i + 1 }));
              return { ...day, meals: remaining };
            }
            if (day.dayOfWeek === toDayOfWeek) {
              const sorted = day.meals.slice().sort((a, b) => a.order - b.order);
              const idx = Math.min(targetIndex, sorted.length);
              sorted.splice(idx, 0, meal);
              const renumbered = sorted.map((m, i) => ({ ...m, order: i + 1 }));
              return { ...day, meals: renumbered };
            }
            return day;
          }),
        };
      }),
    };

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  swapDays: (weekNum, fromDayOfWeek, toDayOfWeek) => {
    const { plan } = get();
    if (!plan || fromDayOfWeek === toDayOfWeek) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) => {
        if (week.weekNumber !== weekNum) return week;

        const dayOrder = [1, 2, 3, 4, 5, 6, 7];
        const fromIdx = dayOrder.indexOf(fromDayOfWeek);
        const toIdx = dayOrder.indexOf(toDayOfWeek);
        dayOrder.splice(fromIdx, 1);
        dayOrder.splice(toIdx, 0, fromDayOfWeek);

        const daysByOriginal = new Map(week.days.map((d) => [d.dayOfWeek, d]));
        const newDays = dayOrder.map((origDay, idx) => {
          const day = daysByOriginal.get(origDay) ?? {
            dayOfWeek: idx + 1,
            meals: [],
            dayTotals: null,
          };
          return { ...day, dayOfWeek: idx + 1 };
        });

        return { ...week, days: newDays };
      }),
    };

    set({ plan: recalculateTotals(updated), isDirty: true });
  },

  addWeek: () => {
    const { plan } = get();
    if (!plan) return;

    const maxWeekNum = Math.max(0, ...plan.weeks.map((w) => w.weekNumber));
    const newWeek = {
      weekNumber: maxWeekNum + 1,
      status: 'Draft' as const,
      datePublished: null,
      days: Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i + 1,
        meals: [],
        dayTotals: null,
      })),
    };

    set({
      plan: { ...plan, weeks: [...plan.weeks, newWeek] },
      isDirty: true,
    });
  },

  removeWeek: (weekNum) => {
    const { plan } = get();
    if (!plan || plan.weeks.length <= 1) return;

    const week = plan.weeks.find((w) => w.weekNumber === weekNum);
    if (!week || week.status === 'Published') return;

    const updated = {
      ...plan,
      weeks: plan.weeks.filter((w) => w.weekNumber !== weekNum),
    };

    set({ plan: updated, isDirty: true, selectedWeek: 1 });
  },

  save: async () => {
    const { plan } = get();
    if (!plan) return;

    set({ isSaving: true });
    try {
      const request: UpdatePlanRequest = {
        name: plan.name,
        globalSettings: plan.globalSettings,
        version: plan.version,
        weeks: plan.weeks.map((week) => ({
          weekNumber: week.weekNumber,
          days: week.days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            meals: day.meals.map((meal) => ({
              mealId: meal.mealId,
              name: meal.name,
              order: meal.order,
              foods: meal.foods.map((food) => ({
                foodExternalId: food.foodExternalId,
                foodName: food.foodName,
                nutrientValuePer100Grams: food.nutrientValuePer100Grams,
                amountGrams: food.amountGrams,
              })),
            })),
          })),
        })),
      };

      const result = await apiUpdatePlan(plan.planId, request);
      set({ plan: recalculateTotals(result), isDirty: false, isSaving: false });
    } catch (error: unknown) {
      set({ isSaving: false });
      // On 409, silently refetch the plan (conflict resolved by reload)
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 409) {
          const fresh = await getPlan(plan.planId);
          set({ plan: recalculateTotals(fresh), isDirty: false });
          return; // Don't re-throw — 409 is handled gracefully
        }
      }
      throw error;
    }
  },

  publishWeek: async (weekNumber) => {
    const { plan } = get();
    if (!plan) return;

    const result = await apiPublishWeek(plan.planId, weekNumber, plan.version);
    set({ plan: recalculateTotals(result), isDirty: false });
  },
}));
