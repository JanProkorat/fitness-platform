import { DietaryStyle, PrimaryGoal, type NutritionPlanTemplateSummaryDto, type OnboardingDataDto } from '@/api/generated';

export type MealsBucket = 'TwoToThree' | 'FourToFive' | 'SixPlus';

/** What the client's onboarding says about the plan they want; every part may be missing. */
export interface ClientCriteria {
  goal?: PrimaryGoal;
  dietaryStyle?: DietaryStyle;
  mealsBucket?: MealsBucket;
  /** The plan's daily kcal target. */
  kcal?: number;
}

export type KcalMatch = { kind: 'close'; percent: number } | { kind: 'near'; percent: number };

/** A template with how well it fits the client, for the chips on its card. */
export interface RankedTemplate {
  template: NutritionPlanTemplateSummaryDto;
  goalMatch: boolean;
  dietMatch: boolean;
  mealsMatch: boolean;
  kcal: KcalMatch | null;
}

export interface RankedLists {
  /** Templates of the client's goal, best first; empty when the client has no goal. */
  matched: RankedTemplate[];
  /** The rest (other goals or no goal). With no client goal this is the one plain list. */
  others: RankedTemplate[];
}

const CLOSE_PERCENT = 5;
const NEAR_PERCENT = 15;

const MEALS_BUCKETS: readonly MealsBucket[] = ['TwoToThree', 'FourToFive', 'SixPlus'];

function parseEnum<T extends string>(values: Record<string, T>, value: string | undefined): T | undefined {
  return Object.values(values).find((candidate) => candidate === value);
}

export function criteriaFromOnboarding(onboarding: OnboardingDataDto | undefined, kcal: number | undefined): ClientCriteria {
  return {
    goal: parseEnum(PrimaryGoal, onboarding?.primaryGoal),
    dietaryStyle: parseEnum(DietaryStyle, onboarding?.dietaryStyle),
    mealsBucket: MEALS_BUCKETS.find((bucket) => bucket === onboarding?.mealsPerDay),
    kcal,
  };
}

function inBucket(mealsPerDay: number | undefined, bucket: MealsBucket | undefined): boolean {
  if (mealsPerDay === undefined || bucket === undefined) {
    return false;
  }
  if (bucket === 'TwoToThree') {
    return mealsPerDay >= 2 && mealsPerDay <= 3;
  }
  return bucket === 'FourToFive' ? mealsPerDay >= 4 && mealsPerDay <= 5 : mealsPerDay >= 6;
}

/** Within 5 % is close, within 15 % is near; nothing when either value is missing or it is further off. */
export function kcalMatch(avgKcal: number | undefined, targetKcal: number | undefined): KcalMatch | null {
  if (avgKcal === undefined || avgKcal === null || !targetKcal) {
    return null;
  }
  const percent = ((avgKcal - targetKcal) / targetKcal) * 100;
  const distance = Math.abs(percent);
  if (distance <= CLOSE_PERCENT) {
    return { kind: 'close', percent: Math.round(percent) };
  }
  return distance <= NEAR_PERCENT ? { kind: 'near', percent: Math.round(percent) } : null;
}

function rank(template: NutritionPlanTemplateSummaryDto, criteria: ClientCriteria): RankedTemplate {
  return {
    template,
    goalMatch: criteria.goal !== undefined && template.goal === criteria.goal,
    dietMatch: criteria.dietaryStyle !== undefined && template.dietaryStyle === criteria.dietaryStyle,
    mealsMatch: inBucket(template.mealsPerDay, criteria.mealsBucket),
    kcal: kcalMatch(template.avgKcalPerDay, criteria.kcal),
  };
}

function kcalDistance(item: RankedTemplate, target: number | undefined): number {
  const avg = item.template.avgKcalPerDay;
  return avg === undefined || avg === null || !target ? Number.POSITIVE_INFINITY : Math.abs(avg - target);
}

/** Dietary style first, then meals per day inside the client's range, then closeness in kcal, then name. */
function compare(criteria: ClientCriteria) {
  return (left: RankedTemplate, right: RankedTemplate): number => {
    if (left.dietMatch !== right.dietMatch) {
      return left.dietMatch ? -1 : 1;
    }
    if (left.mealsMatch !== right.mealsMatch) {
      return left.mealsMatch ? -1 : 1;
    }
    const leftDistance = kcalDistance(left, criteria.kcal);
    const rightDistance = kcalDistance(right, criteria.kcal);
    if (leftDistance !== rightDistance) {
      return leftDistance < rightDistance ? -1 : 1;
    }
    return (left.template.name ?? '').localeCompare(right.template.name ?? '');
  };
}

/**
 * Splits the templates into those of the client's goal and the rest. `goalTemplates` is the list filtered
 * by the client's goal and `allTemplates` the unfiltered one; what the first holds is left out of the second.
 */
export function rankTemplates(
  goalTemplates: readonly NutritionPlanTemplateSummaryDto[],
  allTemplates: readonly NutritionPlanTemplateSummaryDto[],
  criteria: ClientCriteria,
): RankedLists {
  const order = compare(criteria);
  const matched = criteria.goal === undefined ? [] : goalTemplates.map((template) => rank(template, criteria)).sort(order);
  const matchedIds = new Set(matched.map((item) => item.template.templateId));
  const others = allTemplates
    .filter((template) => !matchedIds.has(template.templateId))
    .map((template) => rank(template, criteria))
    .sort(order);
  return { matched, others };
}
