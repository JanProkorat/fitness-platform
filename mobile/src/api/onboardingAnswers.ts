import { api } from '@/api/client';
import type {
  ClientOnboardingAnswersResponse,
  UpdateClientOnboardingAnswersRequest,
} from '@/api/generated';
import { getErrorStatus } from '@/api/errors';
import {
  CURRENT_FREQUENCIES,
  DESIRED_FREQUENCY_VALUES,
  DIET_STYLE_VALUES,
  GOALS,
  GYM_ACCESS,
  JOB_TYPES,
  LIMITS,
  MAX_CHIPS,
  MAX_CHIP_LENGTH,
  MEALS_PER_DAY,
  SEXES,
  desiredDaysFromBackend,
  dietStyleFromBackend,
} from '@/api/onboarding';
import type {
  CurrentFrequency,
  DesiredDays,
  DietStyleChoice,
  Goal,
  GymAccess,
  JobType,
  MealsPerDay,
  Sex,
} from '@/api/onboarding';

export const ONBOARDING_ANSWERS_QUERY_KEY = ['onboarding', 'answers'] as const;

/** Joined length the backend accepts for the injuries, allergies and activities lists. */
export const MAX_JOINED_LIST_LENGTH = 200;

/** Age range the backend accepts for the date of birth. */
export const DATE_OF_BIRTH_AGE = { min: 13, max: 100 } as const;

/** The answers the client can change after onboarding; `null` means the backend has no value. */
export type EditableAnswers = {
  /** Calendar date as `YYYY-MM-DD`. */
  dateOfBirth: string | null;
  sex: Sex | null;
  heightCm: number | null;
  goal: Goal | null;
  targetWeightKg: number | null;
  currentFrequency: CurrentFrequency | null;
  desiredDays: DesiredDays | null;
  gymAccess: GymAccess | null;
  activities: string[];
  injuries: string[];
  jobType: JobType | null;
  sleepHours: number | null;
  stressLevel: number | null;
  mealsPerDay: MealsPerDay | null;
  dietStyle: DietStyleChoice | null;
  allergies: string[];
  dislikes: string[];
  habits: string[];
};

export type AnswerField = keyof EditableAnswers;

const pick = <T extends string>(values: readonly T[], value: string | undefined): T | null =>
  values.find((candidate) => candidate === value) ?? null;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formats a local date as `YYYY-MM-DD` from its local year, month and day (never through UTC). */
export function formatDateOnly(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` into a local-midnight date, or `null` when it is not a real calendar date. */
export function parseDateOnly(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real ? date : null;
}

/** The same month and day `years` earlier; 29 February falls back to 28 February. */
function yearsBefore(date: Date, years: number): Date {
  const year = date.getFullYear() - years;
  const lastDay = new Date(year, date.getMonth() + 1, 0).getDate();
  return new Date(year, date.getMonth(), Math.min(date.getDate(), lastDay));
}

/** The earliest and latest date of birth that give an age of 13-100 on `today` (local, date only). */
export function dateOfBirthBounds(today: Date = new Date()): { min: Date; max: Date } {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const min = yearsBefore(day, DATE_OF_BIRTH_AGE.max + 1);
  min.setDate(min.getDate() + 1);
  return { min, max: yearsBefore(day, DATE_OF_BIRTH_AGE.min) };
}

/** True when `value` is a real `YYYY-MM-DD` date that gives an age of 13-100. */
export function isValidDateOfBirth(value: string, today: Date = new Date()): boolean {
  const date = parseDateOnly(value);
  if (date === null) return false;
  const { min, max } = dateOfBirthBounds(today);
  return date.getTime() >= min.getTime() && date.getTime() <= max.getTime();
}

const dateOfBirthFromBackend = (value: string | undefined): string | null => {
  const day = value?.slice(0, 10);
  return day !== undefined && parseDateOnly(day) !== null ? day : null;
};

const toEditable = (response: ClientOnboardingAnswersResponse): EditableAnswers => ({
  dateOfBirth: dateOfBirthFromBackend(response.dateOfBirth),
  sex: pick(SEXES, response.sex),
  heightCm: response.heightCm ?? null,
  goal: pick(GOALS, response.primaryGoal),
  targetWeightKg: response.targetWeightKg ?? null,
  currentFrequency: pick(CURRENT_FREQUENCIES, response.currentTrainingFrequency),
  desiredDays: desiredDaysFromBackend(response.desiredTrainingFrequency),
  gymAccess: pick(GYM_ACCESS, response.gymAccess),
  activities: response.preferredActivities ?? [],
  injuries: response.injuries ?? [],
  jobType: pick(JOB_TYPES, response.jobType),
  sleepHours: response.sleepHours ?? null,
  stressLevel: response.stressLevel ?? null,
  mealsPerDay: pick(MEALS_PER_DAY, response.mealsPerDay),
  dietStyle: dietStyleFromBackend(response.dietaryStyle),
  allergies: response.allergies ?? [],
  dislikes: response.dislikes ?? [],
  habits: response.habits ?? [],
});

/** Loads the client's onboarding answers (GET /client/onboarding/answers). */
export async function fetchOnboardingAnswers(signal?: AbortSignal): Promise<EditableAnswers> {
  return toEditable(await api.getClientOnboardingAnswersEndpoint(signal));
}

/** True when the backend says there are no answers to edit (no client profile, onboarding unfinished). */
export function isAnswersUnavailable(error: unknown): boolean {
  const status = getErrorStatus(error);
  return status === 404 || status === 409;
}

const LIST_FIELDS = ['activities', 'injuries', 'allergies', 'dislikes', 'habits'] as const;

const SCALAR_FIELDS = [
  'dateOfBirth',
  'sex',
  'heightCm',
  'goal',
  'targetWeightKg',
  'currentFrequency',
  'desiredDays',
  'gymAccess',
  'jobType',
  'sleepHours',
  'stressLevel',
  'mealsPerDay',
  'dietStyle',
] as const satisfies readonly AnswerField[];

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** The fields of `draft` that differ from `base`, in screen order. */
export function changedAnswerFields(base: EditableAnswers, draft: EditableAnswers): AnswerField[] {
  const changed = new Set<AnswerField>();
  for (const field of SCALAR_FIELDS) {
    if (draft[field] !== base[field]) changed.add(field);
  }
  for (const field of LIST_FIELDS) {
    if (!sameList(draft[field], base[field])) changed.add(field);
  }
  return [...changed];
}

/** Keeps a stepped or typed height free of floating-point noise: one decimal place. */
export const roundHeight = (cm: number): number => Math.round(cm * 10) / 10;

/** The partial update for the changed fields; a field with no value is left out, so it stays unchanged. */
export function buildAnswersPatch(
  draft: EditableAnswers,
  fields: AnswerField[],
): UpdateClientOnboardingAnswersRequest {
  const patch: UpdateClientOnboardingAnswersRequest = {};
  for (const field of fields) {
    switch (field) {
      case 'dateOfBirth':
        if (draft.dateOfBirth !== null) patch.dateOfBirth = draft.dateOfBirth;
        break;
      case 'sex':
        if (draft.sex !== null) patch.sex = draft.sex;
        break;
      case 'heightCm':
        if (draft.heightCm !== null) patch.heightCm = roundHeight(draft.heightCm);
        break;
      case 'goal':
        if (draft.goal !== null) patch.primaryGoal = draft.goal;
        break;
      case 'targetWeightKg':
        if (draft.targetWeightKg !== null) patch.targetWeightKg = draft.targetWeightKg;
        break;
      case 'currentFrequency':
        if (draft.currentFrequency !== null) {
          patch.currentTrainingFrequency = draft.currentFrequency;
        }
        break;
      case 'desiredDays':
        if (draft.desiredDays !== null) {
          patch.desiredTrainingFrequency = DESIRED_FREQUENCY_VALUES[draft.desiredDays];
        }
        break;
      case 'gymAccess':
        if (draft.gymAccess !== null) patch.gymAccess = draft.gymAccess;
        break;
      case 'activities':
        patch.preferredActivities = draft.activities;
        break;
      case 'injuries':
        patch.injuries = draft.injuries;
        break;
      case 'jobType':
        if (draft.jobType !== null) patch.jobType = draft.jobType;
        break;
      case 'sleepHours':
        if (draft.sleepHours !== null) patch.sleepHours = draft.sleepHours;
        break;
      case 'stressLevel':
        if (draft.stressLevel !== null) patch.stressLevel = draft.stressLevel;
        break;
      case 'mealsPerDay':
        if (draft.mealsPerDay !== null) patch.mealsPerDay = draft.mealsPerDay;
        break;
      case 'dietStyle':
        if (draft.dietStyle !== null) patch.dietaryStyle = DIET_STYLE_VALUES[draft.dietStyle];
        break;
      case 'allergies':
        patch.allergies = draft.allergies;
        break;
      case 'dislikes':
        patch.dislikes = draft.dislikes;
        break;
      case 'habits':
        patch.habits = draft.habits;
        break;
    }
  }
  return patch;
}

/** Saves a partial update (PATCH /client/onboarding/answers) and returns the stored answers. */
export async function updateOnboardingAnswers(
  patch: UpdateClientOnboardingAnswersRequest,
): Promise<EditableAnswers> {
  return toEditable(await api.updateClientOnboardingAnswersEndpoint(patch));
}

export type AnswerError =
  | 'weightRange'
  | 'heightRange'
  | 'sleepRange'
  | 'stressRange'
  | 'dateOfBirthRange'
  | 'listTooLong'
  | 'tooManyItems'
  | 'itemTooLong'
  | 'itemBlank'
  | 'itemComma';

/** True when `kg` is inside the range the backend accepts for the target weight. */
export const isValidTargetWeight = (kg: number): boolean =>
  Number.isFinite(kg) && kg >= LIMITS.weightKg.min && kg <= LIMITS.weightKg.max;

const inRange = (value: number, range: { min: number; max: number }): boolean =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

/** Client-side mirror of UpdateClientOnboardingAnswersValidator; maps a field to what is wrong with it. */
export function validateAnswers(draft: EditableAnswers): Partial<Record<AnswerField, AnswerError>> {
  const errors: Partial<Record<AnswerField, AnswerError>> = {};
  if (draft.dateOfBirth !== null && !isValidDateOfBirth(draft.dateOfBirth)) {
    errors.dateOfBirth = 'dateOfBirthRange';
  }
  if (draft.heightCm !== null && !inRange(roundHeight(draft.heightCm), LIMITS.heightCm)) {
    errors.heightCm = 'heightRange';
  }
  if (draft.targetWeightKg !== null && !isValidTargetWeight(draft.targetWeightKg)) {
    errors.targetWeightKg = 'weightRange';
  }
  if (draft.sleepHours !== null && !inRange(draft.sleepHours, LIMITS.sleepHours)) {
    errors.sleepHours = 'sleepRange';
  }
  if (draft.stressLevel !== null && !inRange(draft.stressLevel, LIMITS.stress)) {
    errors.stressLevel = 'stressRange';
  }
  for (const field of ['activities', 'injuries', 'allergies'] as const) {
    if (draft[field].map((item) => item.trim()).join(',').length > MAX_JOINED_LIST_LENGTH) {
      errors[field] = 'listTooLong';
    }
  }
  if (draft.activities.some((item) => item.trim().length === 0)) errors.activities = 'itemBlank';
  else if (draft.activities.some((item) => item.includes(','))) errors.activities = 'itemComma';
  for (const field of ['dislikes', 'habits'] as const) {
    if (draft[field].length > MAX_CHIPS) errors[field] = 'tooManyItems';
    else if (draft[field].some((item) => item.trim().length > MAX_CHIP_LENGTH)) {
      errors[field] = 'itemTooLong';
    }
  }
  if (draft.habits.some((item) => item.trim().length === 0)) errors.habits = 'itemBlank';
  return errors;
}
