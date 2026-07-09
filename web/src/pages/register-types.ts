export type Step = 1 | 2 | 3 | 4;

export type Role = 'Trainer' | 'Nutritionist';

// name/desc are i18n keys (not literal text) — resolve with t() at the render
// site. Keeping literal Czech out of this data module per #577.
export const ROLES: { value: Role; icon: string; nameKey: string; descKey: string }[] = [
  { value: 'Trainer', icon: '🏋️', nameKey: 'auth.roleTrainerName', descKey: 'auth.roleTrainerDesc' },
  { value: 'Nutritionist', icon: '🥗', nameKey: 'auth.roleNutritionistName', descKey: 'auth.roleNutritionistDesc' },
];

// labelKey is an i18n key (not literal text) — resolve with t() at the render site.
export const PASSWORD_REQUIREMENTS = [
  { test: (v: string) => v.length >= 8, labelKey: 'auth.passwordReqMinLength' },
  { test: (v: string) => /[A-Z]/.test(v), labelKey: 'auth.passwordReqUppercase' },
  { test: (v: string) => /[a-z]/.test(v), labelKey: 'auth.passwordReqLowercase' },
  { test: (v: string) => /[0-9]/.test(v), labelKey: 'auth.passwordReqDigit' },
];
