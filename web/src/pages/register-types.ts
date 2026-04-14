export type Step = 1 | 2 | 3 | 4;

export type Role = 'Trainer' | 'Nutritionist';

export const ROLES: { value: Role; icon: string; name: string; desc: string }[] = [
  { value: 'Trainer', icon: '🏋️', name: 'Trenér', desc: 'Vytvářím tréninkové plány pro klienty' },
  { value: 'Nutritionist', icon: '🥗', name: 'Nutriční specialista', desc: 'Sestavuji jídelníčky a řeším výživu' },
];

export const PASSWORD_REQUIREMENTS = [
  { test: (v: string) => v.length >= 8, label: 'Alespoň 8 znaků' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Alespoň jedno velké písmeno (A–Z)' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Alespoň jedno malé písmeno (a–z)' },
  { test: (v: string) => /[0-9]/.test(v), label: 'Alespoň jedna číslice (0–9)' },
];
