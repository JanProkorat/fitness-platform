export function computePasswordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  return score;
}

export function strengthClass(s: number): string {
  if (s <= 1) return 'weak';
  if (s <= 2) return 'medium';
  return 'strong';
}
