import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MealKind } from '@/api/generated';
import type {
  NutritionPlanTemplateDetailDto,
  NutritionPlanTemplateWeekRequest,
  TemplateMealRequest,
  UpdateNutritionPlanTemplateRequest,
} from '@/api/nutrition-plan-templates';
import type { PlanEditorSaveState } from '@/components/plan-editor/PlanEditor';
import type { EditorDocument, EditorMeal, EditorWeek } from '@/components/plan-editor/plan-editor-types';
import { useUpdatePlanTemplate } from '@/hooks/usePlanTemplatesQueries';
import { getApiErrorMessage, getErrorStatus } from '@/lib/api-errors';

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/** Maps the stored template to the editor's neutral document. Stored totals are ignored. */
export function toEditorDocument(dto: NutritionPlanTemplateDetailDto): EditorDocument {
  const weeks: EditorWeek[] = [...(dto.weeks ?? [])]
    .sort((left, right) => (left.weekNumber ?? 0) - (right.weekNumber ?? 0))
    .map((week, weekIndex) => ({
      weekNumber: week.weekNumber ?? weekIndex + 1,
      days: [...(week.days ?? [])]
        .sort((left, right) => (left.dayOfWeek ?? 0) - (right.dayOfWeek ?? 0))
        .map((day) => ({
          dayOfWeek: day.dayOfWeek ?? 1,
          note: nullToUndefined(day.note),
          meals: [...(day.meals ?? [])]
            .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
            .map((meal, mealIndex): EditorMeal => ({
              mealId: meal.mealId ?? crypto.randomUUID(),
              kind: meal.kind ?? MealKind.Breakfast,
              order: meal.order ?? mealIndex + 1,
              time: nullToUndefined(meal.time),
              note: nullToUndefined(meal.note),
              foods: (meal.foods ?? []).map((food) => ({
                foodExternalId: food.foodExternalId ?? '',
                foodName: food.foodName ?? '',
                foodNameCs: nullToUndefined(food.foodNameCs),
                foodNameEn: nullToUndefined(food.foodNameEn),
                foodNameDe: nullToUndefined(food.foodNameDe),
                foodCategory: nullToUndefined(food.foodCategory),
                nutrientValuePer100Grams: food.nutrientValuePer100Grams ?? {},
                amountGrams: food.amountGrams ?? 0,
                note: nullToUndefined(food.note),
              })),
              recipes: (meal.recipes ?? []).map((recipe) => ({
                recipeId: recipe.recipeId ?? '',
                recipeName: recipe.recipeName ?? '',
                nutrientValuePerServing: recipe.nutrientValuePerServing ?? {},
                servings: recipe.servings ?? 1,
                note: nullToUndefined(recipe.note),
                foodCategories: nullToUndefined(recipe.foodCategories),
              })),
            })),
        })),
    }));
  return { name: dto.name ?? '', weeks };
}

function toRequestMeal(meal: EditorMeal): TemplateMealRequest {
  return {
    mealId: meal.mealId,
    kind: meal.kind,
    order: meal.order,
    time: meal.time,
    note: meal.note,
    foods: meal.foods.map((food) => ({ ...food })),
    recipes: meal.recipes.map((recipe) => ({ ...recipe })),
  };
}

function toRequestWeeks(weeks: EditorWeek[]): NutritionPlanTemplateWeekRequest[] {
  return weeks.map((week) => ({
    weekNumber: week.weekNumber,
    days: week.days.map((day) => ({
      dayOfWeek: day.dayOfWeek,
      note: day.note,
      meals: day.meals.map(toRequestMeal),
    })),
  }));
}

/**
 * The PUT replaces the whole template, so everything the editor does not change (description, goal,
 * dietary style, targets, supplements) is echoed back from the loaded copy.
 */
export function toUpdateRequest(
  loaded: NutritionPlanTemplateDetailDto,
  doc: EditorDocument,
  version: number | undefined,
): UpdateNutritionPlanTemplateRequest {
  return {
    name: doc.name.trim(),
    description: nullToUndefined(loaded.description),
    goal: nullToUndefined(loaded.goal),
    dietaryStyle: nullToUndefined(loaded.dietaryStyle),
    globalSettings: nullToUndefined(loaded.globalSettings),
    supplements: (loaded.supplements ?? []).map((supplement) => ({
      externalId: supplement.externalId,
      name: supplement.name,
      dose: nullToUndefined(supplement.dose),
      notes: nullToUndefined(supplement.notes),
    })),
    weeks: toRequestWeeks(doc.weeks),
    version,
  };
}

/**
 * Host logic for editing a plan template: the editor's initial document, the save call, and the
 * save/conflict state. The loaded copy is captured once, so a background refetch can never change
 * the version the next save is checked against.
 */
export function usePlanTemplateEditor(loadedDto: NutritionPlanTemplateDetailDto) {
  const { t } = useTranslation();
  const [loaded] = useState(loadedDto);
  const [initial] = useState(() => toEditorDocument(loadedDto));
  const versionRef = useRef(loadedDto.version);
  const mutation = useUpdatePlanTemplate(loadedDto.templateId ?? '');
  const [saveState, setSaveState] = useState<PlanEditorSaveState>({ status: 'idle' });

  async function save(doc: EditorDocument): Promise<EditorDocument | null> {
    setSaveState({ status: 'saving' });
    try {
      const saved = await mutation.mutateAsync(toUpdateRequest(loaded, doc, versionRef.current));
      versionRef.current = saved.version;
      setSaveState({ status: 'idle' });
      return toEditorDocument(saved);
    } catch (error) {
      if (getErrorStatus(error) === 409) {
        setSaveState({ status: 'conflict', message: t('planEditor.conflict.message') });
      } else {
        setSaveState({ status: 'error', message: getApiErrorMessage(error, 'planEditor.saveError') });
      }
      return null;
    }
  }

  return { initial, saveState, save };
}
