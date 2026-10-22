import { api } from '@/api/client';
import type {
  ClientOnboardingAnswersResponse,
  UpdateClientOnboardingAnswersRequest,
} from '@/api/generated';
import { getErrorStatus } from '@/api/errors';
import {
  DESIRED_FREQUENCY_VALUES,
  DIET_STYLE_VALUES,
  GOALS,
  GYM_ACCESS,
  LIMITS,
  MAX_CHIPS,
  MAX_CHIP_LENGTH,
  desiredDaysFromBackend,
  dietStyleFromBackend,
} from '@/api/onboarding';
import type { DesiredDays, DietStyleChoice, Goal, GymAccess } from '@/api/onboarding';

export const ONBOARDING_ANSWERS_QUERY_KEY = ['onboarding', 'answers'] as const;

/** Joined length the backend accepts for the injuries and allergies lists. */
export const MAX_JOINED_LIST_LENGTH = 200;

/** The answers the client can change after onboarding; `null` means the backend has no value. */
export type EditableAnswers = {
  goal: Goal | null;
  targetWeightKg: number | null;
  desiredDays: DesiredDays | null;
  gymAccess: GymAccess | null;
  injuries: string[];
  dietStyle: DietStyleChoice | null;
  allergies: string[];
  dislikes: string[];
};

export type AnswerField = keyof EditableAnswers;

const asGoal = (value: string | undefined): Goal | null =>
  GOALS.find((goal) => goal === value) ?? null;

const asGymAccess = (value: string | undefined): GymAccess | null =>
  GYM_ACCESS.find((access) => access === value) ?? null;

const toEditable = (response: ClientOnboardingAnswersResponse): EditableAnswers => ({
  goal: asGoal(response.primaryGoal),
  targetWeightKg: response.targetWeightKg ?? null,
  desiredDays: desiredDaysFromBackend(response.desiredTrainingFrequency),
  gymAccess: asGymAccess(response.gymAccess),
  injuries: response.injuries ?? [],
  dietStyle: dietStyleFromBackend(response.dietaryStyle),
  allergies: response.allergies ?? [],
  dislikes: response.dislikes ?? [],
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

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** The fields of `draft` that differ from `base`. */
export function changedAnswerFields(base: EditableAnswers, draft: EditableAnswers): AnswerField[] {
  const changed: AnswerField[] = [];
  if (draft.goal !== base.goal) changed.push('goal');
  if (draft.targetWeightKg !== base.targetWeightKg) changed.push('targetWeightKg');
  if (draft.desiredDays !== base.desiredDays) changed.push('desiredDays');
  if (draft.gymAccess !== base.gymAccess) changed.push('gymAccess');
  if (!sameList(draft.injuries, base.injuries)) changed.push('injuries');
  if (draft.dietStyle !== base.dietStyle) changed.push('dietStyle');
  if (!sameList(draft.allergies, base.allergies)) changed.push('allergies');
  if (!sameList(draft.dislikes, base.dislikes)) changed.push('dislikes');
  return changed;
}

/** The partial update for the changed fields; a field with no value is left out, so it stays unchanged. */
export function buildAnswersPatch(
  draft: EditableAnswers,
  fields: AnswerField[],
): UpdateClientOnboardingAnswersRequest {
  const patch: UpdateClientOnboardingAnswersRequest = {};
  for (const field of fields) {
    switch (field) {
      case 'goal':
        if (draft.goal !== null) patch.primaryGoal = draft.goal;
        break;
      case 'targetWeightKg':
        if (draft.targetWeightKg !== null) patch.targetWeightKg = draft.targetWeightKg;
        break;
      case 'desiredDays':
        if (draft.desiredDays !== null) {
          patch.desiredTrainingFrequency = DESIRED_FREQUENCY_VALUES[draft.desiredDays];
        }
        break;
      case 'gymAccess':
        if (draft.gymAccess !== null) patch.gymAccess = draft.gymAccess;
        break;
      case 'injuries':
        patch.injuries = draft.injuries;
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

export type AnswerError = 'weightRange' | 'listTooLong' | 'tooManyItems' | 'itemTooLong';

/** True when `kg` is inside the range the backend accepts for the target weight. */
export const isValidTargetWeight = (kg: number): boolean =>
  Number.isFinite(kg) && kg >= LIMITS.weightKg.min && kg <= LIMITS.weightKg.max;

/** Client-side mirror of UpdateClientOnboardingAnswersValidator; maps a field to what is wrong with it. */
export function validateAnswers(draft: EditableAnswers): Partial<Record<AnswerField, AnswerError>> {
  const errors: Partial<Record<AnswerField, AnswerError>> = {};
  if (draft.targetWeightKg !== null && !isValidTargetWeight(draft.targetWeightKg)) {
    errors.targetWeightKg = 'weightRange';
  }
  for (const field of ['injuries', 'allergies'] as const) {
    if (draft[field].join(',').length > MAX_JOINED_LIST_LENGTH) errors[field] = 'listTooLong';
  }
  if (draft.dislikes.length > MAX_CHIPS) errors.dislikes = 'tooManyItems';
  else if (draft.dislikes.some((item) => item.length > MAX_CHIP_LENGTH)) {
    errors.dislikes = 'itemTooLong';
  }
  return errors;
}
