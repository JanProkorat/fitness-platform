import { z } from 'zod';
import type { OnboardingDataDto } from '@/api/generated';

export const MAX_PROFILE_ITEMS = 20;
export const MAX_ITEM_LENGTH = 60;
export const MAX_ALLERGIES_LENGTH = 200;
export const MAX_FIBRE_GRAMS = 150;

/** Stored allergy codes of a comma-separated onboarding value, without blanks and the "none" marker. */
export function splitAllergies(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0 && code.toLowerCase() !== 'none');
}

/** True when the client has none of the targets a fibre target can be attached to. */
export function hasNoTargets(onboarding: OnboardingDataDto | undefined): boolean {
  return (
    onboarding?.adjustedKcal == null &&
    onboarding?.proteinGrams == null &&
    onboarding?.carbsGrams == null &&
    onboarding?.fatGrams == null
  );
}

const listItem = z.string().trim().min(1).max(MAX_ITEM_LENGTH);

/** Mirrors the backend UpdateClientNutritionProfileValidator. */
export const nutritionProfileSchema = z.object({
  allergies: z
    .array(z.string().trim().min(1))
    .refine((items) => items.every((item) => !item.includes(',')), { message: 'comma' })
    .refine((items) => items.join(',').length <= MAX_ALLERGIES_LENGTH, { message: 'tooLong' }),
  dislikes: z.array(listItem).max(MAX_PROFILE_ITEMS),
  habits: z.array(listItem).max(MAX_PROFILE_ITEMS),
  fibreGrams: z.string().refine(
    (value) => {
      const trimmed = value.trim();
      if (trimmed === '') {
        return true;
      }
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_FIBRE_GRAMS;
    },
    { message: 'fibre' },
  ),
});

export type NutritionProfileFormValues = z.infer<typeof nutritionProfileSchema>;

/** Empty fibre is sent as undefined, which keeps the stored target. */
export function parseFibre(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : Number(trimmed);
}
