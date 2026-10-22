import { api } from '@/api/client';
import type { SubmitOnboardingRequest } from '@/api/generated';
import { isNetworkError } from '@/api/errors';

export const GOALS = [
  'LoseFat',
  'GainMuscle',
  'Recomposition',
  'Fitness',
  'Health',
  'Maintain',
  'Performance',
] as const;
export type Goal = (typeof GOALS)[number];

export const HORIZONS = ['ThreeMonths', 'SixMonths', 'OneYear'] as const;
export type Horizon = (typeof HORIZONS)[number];

export const SEXES = ['Female', 'Male'] as const;
export type Sex = (typeof SEXES)[number];

/** What the client picks; the backend names these Ectomorph, Mesomorph and Endomorph. */
export const BODY_TYPES = ['Slim', 'Athletic', 'Solid'] as const;
export type BodyTypeChoice = (typeof BODY_TYPES)[number];
const BODY_TYPE_VALUES: Record<BodyTypeChoice, string> = {
  Slim: 'Ectomorph',
  Athletic: 'Mesomorph',
  Solid: 'Endomorph',
};

export const JOB_TYPES = ['Sedentary', 'Standing', 'Physical'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const CURRENT_FREQUENCIES = ['None', 'Occasional', 'Regular', 'High'] as const;
export type CurrentFrequency = (typeof CURRENT_FREQUENCIES)[number];

export const DESIRED_DAYS = [2, 3, 4, 5] as const;
export type DesiredDays = (typeof DESIRED_DAYS)[number];
export const DESIRED_FREQUENCY_VALUES: Record<DesiredDays, string> = {
  2: 'TwoPerWeek',
  3: 'ThreePerWeek',
  4: 'FourPerWeek',
  5: 'FivePerWeek',
};

export const GYM_ACCESS = ['Yes', 'Sometimes', 'No'] as const;
export type GymAccess = (typeof GYM_ACCESS)[number];

export const MEALS_PER_DAY = ['TwoToThree', 'FourToFive', 'SixPlus'] as const;
export type MealsPerDay = (typeof MEALS_PER_DAY)[number];

/** What the client picks; the backend calls "Anything" Standard. */
export const DIET_STYLES = ['Anything', 'Vegetarian', 'Vegan', 'GlutenFree'] as const;
export type DietStyleChoice = (typeof DIET_STYLES)[number];
export const DIET_STYLE_VALUES: Record<DietStyleChoice, string> = {
  Anything: 'Standard',
  Vegetarian: 'Vegetarian',
  Vegan: 'Vegan',
  GlutenFree: 'GlutenFree',
};

/** The days-a-week choice for a backend frequency name, or `null` when it is not one of the four. */
export function desiredDaysFromBackend(value: string | undefined): DesiredDays | null {
  return DESIRED_DAYS.find((days) => DESIRED_FREQUENCY_VALUES[days] === value) ?? null;
}

/** The diet choice for a backend dietary-style name, or `null` when it is not one of the four. */
export function dietStyleFromBackend(value: string | undefined): DietStyleChoice | null {
  return DIET_STYLES.find((style) => DIET_STYLE_VALUES[style] === value) ?? null;
}

export const PLAN_EXPERIENCES = ['Never', 'TriedFailed', 'TriedSucceeded'] as const;
export type PlanExperience = (typeof PLAN_EXPERIENCES)[number];

export const MOTIVATIONS = ['Appearance', 'Health', 'Performance', 'Confidence'] as const;
export type Motivation = (typeof MOTIVATIONS)[number];

/** Bounds mirror SubmitOnboardingValidator. */
export const LIMITS = {
  age: { min: 15, max: 80 },
  heightCm: { min: 140, max: 220 },
  weightKg: { min: 40, max: 250 },
  sleepHours: { min: 1, max: 10 },
  stress: { min: 1, max: 5 },
  fitness: { min: 1, max: 10 },
  dietRating: { min: 1, max: 5 },
} as const;

export const MAX_CHIPS = 20;
export const MAX_CHIP_LENGTH = 60;

export const CHIP_LIST_KEYS = [
  'activities',
  'injuries',
  'allergies',
  'dislikes',
  'blockers',
  'habits',
] as const;
export type ChipListKey = (typeof CHIP_LIST_KEYS)[number];

/** Every answer of the questionnaire; `null` means not answered yet. */
export type OnboardingAnswers = {
  goal: Goal | null;
  horizon: Horizon | null;
  sex: Sex | null;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number | null;
  bodyType: BodyTypeChoice | null;
  jobType: JobType | null;
  sleepHours: number;
  stress: number | null;
  currentFrequency: CurrentFrequency | null;
  desiredDays: DesiredDays | null;
  fitness: number | null;
  gymAccess: GymAccess | null;
  mealsPerDay: MealsPerDay | null;
  dietStyle: DietStyleChoice | null;
  dietRating: number | null;
  planExperience: PlanExperience | null;
  motivation: Motivation | null;
  lists: Record<ChipListKey, string[]>;
};

export const INITIAL_ANSWERS: OnboardingAnswers = {
  goal: null,
  horizon: null,
  sex: null,
  age: 30,
  heightCm: 170,
  weightKg: 70,
  targetWeightKg: null,
  bodyType: null,
  jobType: null,
  sleepHours: 7,
  stress: null,
  currentFrequency: null,
  desiredDays: null,
  fitness: null,
  gymAccess: null,
  mealsPerDay: null,
  dietStyle: null,
  dietRating: null,
  planExperience: null,
  motivation: null,
  lists: { activities: [], injuries: [], allergies: [], dislikes: [], blockers: [], habits: [] },
};

export const TOTAL_STEPS = 6;

/** True when every required answer of the 1-based step is set. */
export function isStepComplete(step: number, answers: OnboardingAnswers): boolean {
  switch (step) {
    case 1:
      return answers.goal !== null && answers.horizon !== null;
    case 2:
      return answers.sex !== null && answers.bodyType !== null;
    case 3:
      return answers.jobType !== null && answers.stress !== null;
    case 4:
      return (
        answers.currentFrequency !== null &&
        answers.desiredDays !== null &&
        answers.fitness !== null
      );
    case 5:
      return answers.mealsPerDay !== null && answers.dietStyle !== null;
    case 6:
      return answers.planExperience !== null && answers.motivation !== null;
    default:
      return false;
  }
}

/**
 * Adds the comma-separated entries of `raw` to `items`: trimmed, blanks dropped, duplicates
 * (case-insensitive) skipped, each cut to the backend's length limit, the list capped.
 * The backend joins most lists with commas, so no entry may contain one.
 */
export function addChips(items: string[], raw: string): string[] {
  const next = [...items];
  const seen = new Set(next.map((item) => item.toLowerCase()));
  for (const part of raw.split(',')) {
    if (next.length >= MAX_CHIPS) break;
    const entry = part.trim().slice(0, MAX_CHIP_LENGTH).trim();
    if (entry.length === 0 || seen.has(entry.toLowerCase())) continue;
    seen.add(entry.toLowerCase());
    next.push(entry);
  }
  return next;
}

/** The request for complete answers, or `null` while a required answer is missing. */
export function buildOnboardingRequest(answers: OnboardingAnswers): SubmitOnboardingRequest | null {
  const {
    goal,
    horizon,
    sex,
    bodyType,
    jobType,
    stress,
    currentFrequency,
    desiredDays,
    fitness,
    mealsPerDay,
    dietStyle,
    planExperience,
    motivation,
  } = answers;
  if (
    goal === null ||
    horizon === null ||
    sex === null ||
    bodyType === null ||
    jobType === null ||
    stress === null ||
    currentFrequency === null ||
    desiredDays === null ||
    fitness === null ||
    mealsPerDay === null ||
    dietStyle === null ||
    planExperience === null ||
    motivation === null
  ) {
    return null;
  }
  const { lists } = answers;
  return {
    primaryGoal: goal,
    timeHorizon: horizon,
    sex,
    age: answers.age,
    heightCm: answers.heightCm,
    weightKg: answers.weightKg,
    targetWeightKg: answers.targetWeightKg ?? undefined,
    bodyType: BODY_TYPE_VALUES[bodyType],
    jobType,
    sleepHours: answers.sleepHours,
    stressLevel: stress,
    currentTrainingFrequency: currentFrequency,
    desiredTrainingFrequency: DESIRED_FREQUENCY_VALUES[desiredDays],
    fitnessRating: fitness,
    gymAccess: answers.gymAccess ?? undefined,
    preferredActivities: lists.activities,
    injuries: lists.injuries,
    mealsPerDay,
    dietaryStyle: DIET_STYLE_VALUES[dietStyle],
    allergies: lists.allergies,
    dislikes: lists.dislikes,
    habits: lists.habits,
    dietRating: answers.dietRating ?? undefined,
    planExperience,
    pastBlockers: lists.blockers,
    primaryMotivation: motivation,
  };
}

/** Saves the questionnaire (POST /client/onboarding). */
export async function submitOnboarding(request: SubmitOnboardingRequest): Promise<void> {
  await api.submitOnboardingEndpoint(request);
}

export type OnboardingFailure = 'network' | 'generic';

/** Maps anything `submitOnboarding` can throw to the line the screen shows. */
export function classifyOnboardingError(error: unknown): OnboardingFailure {
  return isNetworkError(error) ? 'network' : 'generic';
}
