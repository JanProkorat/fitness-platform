import {
  DAYS_PER_WEEK,
  MAX_MEALS_PER_DAY,
  MAX_WEEKS,
  type EditorDay,
  type EditorDocument,
  type EditorMeal,
  type EditorWeek,
} from '@/components/plan-editor/plan-editor-types';
import { weekHasItems } from '@/components/plan-editor/plan-editor-ops';

/** How a template lands on a plan, worked out before anything is applied. */
export interface ApplyPreview {
  /** Week numbers whose meals the template replaces. */
  draftWeeks: number[];
  /** Week numbers left as they are. */
  publishedWeeks: number[];
  /** The plan's length once the template is applied. */
  resultLength: number;
  /** True when the plan has more draft weeks than the template has weeks, so repeating can keep its length. */
  canKeepLength: boolean;
}

/** A plan with no meals and nothing published is filled straight away; anything else asks first. */
export function needsConfirmation(doc: EditorDocument, publishedWeeks: readonly number[]): boolean {
  return publishedWeeks.length > 0 || doc.weeks.some(weekHasItems);
}

/** The published week numbers that exist in the document, ascending. */
function existingPublished(doc: EditorDocument, publishedWeeks: readonly number[]): number[] {
  const numbers = new Set(doc.weeks.map((week) => week.weekNumber));
  return [...new Set(publishedWeeks)].filter((number) => numbers.has(number)).sort((left, right) => left - right);
}

/**
 * Length of the plan after the template: the plan's own length when repeating, otherwise the published
 * weeks plus one run of the template. Never shorter than the last published week, never over the cap.
 */
function resultLengthFor(planLength: number, published: readonly number[], templateLength: number, keepLength: boolean) {
  const last = published.length > 0 ? Math.max(...published) : 0;
  const wanted = keepLength ? planLength : Math.max(last, published.length + templateLength);
  return Math.min(Math.max(wanted, last), MAX_WEEKS);
}

/** Describes the outcome without changing the document, for the replace dialog. */
export function previewApply(
  doc: EditorDocument,
  publishedWeeks: readonly number[],
  templateLength: number,
  keepLength: boolean,
): ApplyPreview {
  const published = existingPublished(doc, publishedWeeks);
  const resultLength = resultLengthFor(doc.weeks.length, published, templateLength, keepLength);
  const publishedSet = new Set(published);
  const draftWeeks = Array.from({ length: resultLength }, (_, index) => index + 1).filter((number) => !publishedSet.has(number));
  return {
    draftWeeks,
    publishedWeeks: published,
    resultLength,
    canKeepLength: templateLength < doc.weeks.length - published.length,
  };
}

/** "3–12" for one run of weeks, "1, 2, 5" when there are gaps. */
export function formatWeekNumbers(weeks: readonly number[]): string {
  const sorted = [...weeks].sort((left, right) => left - right);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (sorted.length > 1 && last - first === sorted.length - 1) {
    return `${first}–${last}`;
  }
  return sorted.join(', ');
}

function copyMeal(meal: EditorMeal, order: number): EditorMeal {
  return {
    mealId: crypto.randomUUID(),
    kind: meal.kind,
    order,
    time: meal.time,
    note: meal.note,
    foods: meal.foods.map((food) => ({ ...food })),
    recipes: meal.recipes.map((recipe) => ({ ...recipe })),
  };
}

/** A copy of a template week as week `weekNumber`: seven days, every meal with a fresh id. */
function copyTemplateWeek(source: EditorWeek, weekNumber: number): EditorWeek {
  const days: EditorDay[] = Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const sourceDay = source.days.find((day) => day.dayOfWeek === index + 1);
    return {
      dayOfWeek: index + 1,
      note: sourceDay?.note,
      meals: (sourceDay?.meals ?? []).slice(0, MAX_MEALS_PER_DAY).map((meal, mealIndex) => copyMeal(meal, mealIndex + 1)),
    };
  });
  return { weekNumber, days };
}

/**
 * Puts a template into a plan. Published weeks keep their number and content; the draft weeks, in order,
 * take the template's weeks one after another, starting over when the template runs out. Weeks are
 * numbered 1..length without gaps, and no published week is ever dropped.
 */
export function applyTemplate(
  doc: EditorDocument,
  templateWeeks: readonly EditorWeek[],
  publishedWeeks: readonly number[],
  keepLength: boolean,
): EditorDocument {
  if (templateWeeks.length === 0) {
    return doc;
  }
  const { publishedWeeks: published, resultLength } = previewApply(doc, publishedWeeks, templateWeeks.length, keepLength);
  const publishedSet = new Set(published);
  let slot = 0;
  const weeks = Array.from({ length: resultLength }, (_, index): EditorWeek => {
    const weekNumber = index + 1;
    if (publishedSet.has(weekNumber)) {
      const kept = doc.weeks.find((week) => week.weekNumber === weekNumber);
      return kept ?? copyTemplateWeek({ weekNumber, days: [] }, weekNumber);
    }
    const source = templateWeeks[slot % templateWeeks.length];
    slot += 1;
    return copyTemplateWeek(source, weekNumber);
  });
  return { ...doc, weeks };
}
