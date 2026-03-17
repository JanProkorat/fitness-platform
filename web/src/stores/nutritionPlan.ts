import { create } from 'zustand';
import type {
  NutritionPlanDetail,
  PlanMeal,
  MealFood,
  NutrientTotals,
} from '@/api/plan-types';
import {
  addMeal as apiAddMeal,
  deleteMeal as apiDeleteMeal,
  addFoodToMeal as apiAddFood,
  removeFoodFromMeal as apiRemoveFood,
  updateMeal as apiUpdateMeal,
  updateDay as apiUpdateDay,
  getPlan,
} from '@/api/plans';

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
  persistDays: (weekNum: number, dayOfWeeks: number[]) => void;
  swapDays: (weekNum: number, fromDayOfWeek: number, toDayOfWeek: number) => void;
  markSaved: (version: number) => void;
  setSaving: (saving: boolean) => void;
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

/** Debounce timer for food amount changes. */
let amountSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** Re-fetch the plan from the API to sync version and server-calculated data. */
async function refreshPlan(planId: string) {
  try {
    const fresh = await getPlan(planId);
    useNutritionPlanStore.getState().setPlan(fresh);
  } catch {
    // If refresh fails, local state is still showing optimistic data
  }
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

  setSaving: (saving) => {
    set({ isSaving: saving });
  },

  updateFoodAmount: (weekNum, dayOfWeek, mealId, foodExternalId, amountGrams) => {
    const { plan } = get();
    if (!plan) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) =>
                day.dayOfWeek !== dayOfWeek
                  ? day
                  : {
                      ...day,
                      meals: day.meals.map((meal) =>
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
                    },
              ),
            },
      ),
    };

    const recalculated = recalculateTotals(updated);
    set({ plan: recalculated, isDirty: false });

    // Debounce: persist the whole day after user stops typing
    if (amountSaveTimer) clearTimeout(amountSaveTimer);
    amountSaveTimer = setTimeout(() => {
      const currentPlan = get().plan;
      if (!currentPlan) return;
      const day = currentPlan.weeks
        .find((w) => w.weekNumber === weekNum)
        ?.days.find((d) => d.dayOfWeek === dayOfWeek);
      if (!day) return;
      apiUpdateDay(currentPlan.planId, weekNum, dayOfWeek, day.meals)
        .then(() => refreshPlan(currentPlan.planId));
    }, 1000);
  },

  addFoodToMeal: (weekNum, dayOfWeek, mealId, food) => {
    const { plan } = get();
    if (!plan) return;

    // Optimistic local update
    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) =>
                day.dayOfWeek !== dayOfWeek
                  ? day
                  : {
                      ...day,
                      meals: day.meals.map((meal) =>
                        meal.mealId !== mealId
                          ? meal
                          : { ...meal, foods: [...meal.foods, food] },
                      ),
                    },
              ),
            },
      ),
    };

    set({ plan: recalculateTotals(updated), isDirty: false });

    // Persist to backend
    apiAddFood(plan.planId, mealId, {
      foodExternalId: food.foodExternalId,
      foodName: food.foodName,
      nutrientValuePer100Grams: food.nutrientValuePer100Grams,
      amountGrams: food.amountGrams,
    }).then(() => refreshPlan(plan.planId));
  },

  removeFoodFromMeal: (weekNum, dayOfWeek, mealId, foodExternalId) => {
    const { plan } = get();
    if (!plan) return;

    // Optimistic local update
    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) =>
                day.dayOfWeek !== dayOfWeek
                  ? day
                  : {
                      ...day,
                      meals: day.meals.map((meal) =>
                        meal.mealId !== mealId
                          ? meal
                          : {
                              ...meal,
                              foods: meal.foods.filter(
                                (f) => f.foodExternalId !== foodExternalId,
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    };

    set({ plan: recalculateTotals(updated), isDirty: false });

    // Persist to backend
    apiRemoveFood(plan.planId, mealId, foodExternalId)
      .then(() => refreshPlan(plan.planId));
  },

  addMeal: (weekNum, dayOfWeek, meal) => {
    const { plan } = get();
    if (!plan) return;

    // Optimistic local update
    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) =>
                day.dayOfWeek !== dayOfWeek
                  ? day
                  : { ...day, meals: [...day.meals, meal] },
              ),
            },
      ),
    };

    set({ plan: recalculateTotals(updated), isDirty: false });

    // Persist to backend
    apiAddMeal(plan.planId, weekNum, dayOfWeek, {
      name: meal.name,
      order: meal.order,
      time: meal.time,
    }).then(() => refreshPlan(plan.planId));
  },

  removeMeal: (weekNum, dayOfWeek, mealId) => {
    const { plan } = get();
    if (!plan) return;

    // Optimistic local update
    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) =>
                day.dayOfWeek !== dayOfWeek
                  ? day
                  : {
                      ...day,
                      meals: day.meals.filter((m) => m.mealId !== mealId),
                    },
              ),
            },
      ),
    };

    set({ plan: recalculateTotals(updated), isDirty: false });

    // Persist to backend
    apiDeleteMeal(plan.planId, weekNum, dayOfWeek, mealId)
      .then(() => refreshPlan(plan.planId));
  },

  updateMealName: (weekNum, dayOfWeek, mealId, name) => {
    const { plan } = get();
    if (!plan) return;

    // Optimistic local update
    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) =>
                day.dayOfWeek !== dayOfWeek
                  ? day
                  : {
                      ...day,
                      meals: day.meals.map((meal) =>
                        meal.mealId !== mealId ? meal : { ...meal, name },
                      ),
                    },
              ),
            },
      ),
    };

    set({ plan: recalculateTotals(updated), isDirty: false });

    // Find the meal's current order for the required field
    const meal = plan.weeks
      .find((w) => w.weekNumber === weekNum)
      ?.days.find((d) => d.dayOfWeek === dayOfWeek)
      ?.meals.find((m) => m.mealId === mealId);

    // Persist to backend
    apiUpdateMeal(plan.planId, weekNum, dayOfWeek, mealId, { name, order: meal?.order ?? 1 })
      .then(() => refreshPlan(plan.planId));
  },

  reorderMeals: (weekNum, dayOfWeek, mealIds) => {
    const { plan } = get();
    if (!plan) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) =>
        week.weekNumber !== weekNum
          ? week
          : {
              ...week,
              days: week.days.map((day) => {
                if (day.dayOfWeek !== dayOfWeek) return day;
                const reordered = mealIds
                  .map((id, idx) => {
                    const meal = day.meals.find((m) => m.mealId === id);
                    return meal ? { ...meal, order: idx + 1 } : null;
                  })
                  .filter(Boolean) as PlanMeal[];
                return { ...day, meals: reordered };
              }),
            },
      ),
    };

    set({ plan: recalculateTotals(updated), isDirty: false });
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
              // Remove meal from source day and re-number
              const remaining = day.meals
                .filter((m) => m.mealId !== mealId)
                .sort((a, b) => a.order - b.order)
                .map((m, i) => ({ ...m, order: i + 1 }));
              return { ...day, meals: remaining };
            }
            if (day.dayOfWeek === toDayOfWeek) {
              // Insert meal into target day at the given index
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

    set({ plan: recalculateTotals(updated), isDirty: false });
  },

  persistDays: (weekNum, dayOfWeeks) => {
    const { plan } = get();
    if (!plan) return;

    const week = plan.weeks.find((w) => w.weekNumber === weekNum);
    if (!week) return;

    const promises = dayOfWeeks.map((dow) => {
      const day = week.days.find((d) => d.dayOfWeek === dow);
      return day ? apiUpdateDay(plan.planId, weekNum, dow, day.meals) : Promise.resolve();
    });
    Promise.all(promises).then(() => refreshPlan(plan.planId));
  },

  swapDays: (weekNum, fromDayOfWeek, toDayOfWeek) => {
    const { plan } = get();
    if (!plan || fromDayOfWeek === toDayOfWeek) return;

    const updated: NutritionPlanDetail = {
      ...plan,
      weeks: plan.weeks.map((week) => {
        if (week.weekNumber !== weekNum) return week;

        // Get the current day order
        const dayOrder = [1, 2, 3, 4, 5, 6, 7];
        const fromIdx = dayOrder.indexOf(fromDayOfWeek);
        const toIdx = dayOrder.indexOf(toDayOfWeek);

        // Reorder: remove from old position, insert at new
        dayOrder.splice(fromIdx, 1);
        dayOrder.splice(toIdx, 0, fromDayOfWeek);

        // Reassign dayOfWeek values so the content shifts
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

    set({ plan: recalculateTotals(updated), isDirty: false });

    // Persist all affected days
    const week = updated.weeks.find((w) => w.weekNumber === weekNum);
    if (week) {
      const promises = week.days.map((day) =>
        apiUpdateDay(plan.planId, weekNum, day.dayOfWeek, day.meals),
      );
      Promise.all(promises).then(() => refreshPlan(plan.planId));
    }
  },

  markSaved: (version) => {
    const { plan } = get();
    if (!plan) return;
    set({ plan: { ...plan, version }, isDirty: false, isSaving: false });
  },
}));
