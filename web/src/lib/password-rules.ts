/**
 * Password rules for the register form, mirroring ASP.NET Identity exactly
 * as configured in `Program.cs` (RequireDigit, RequireLowercase,
 * RequireUppercase, RequiredLength 8, RequireNonAlphanumeric FALSE). A
 * special character is deliberately NOT one of these rules — the backend
 * does not require one, so demanding it client-side would reject a
 * password the server accepts, and (worse) the inverse mismatch would
 * accept a password server-side rejects with a raw Identity message.
 *
 * Kept separate from `lib/password-strength.ts` (the older strength-meter
 * scorer used by the pre-#1058 registration wizard and reset-password
 * page) rather than reusing it — that module scores a special character
 * and omits lowercase entirely, which is exactly backwards for this
 * contract.
 */
export interface PasswordRuleResult {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasDigit: boolean;
}

export function evaluatePasswordRules(password: string): PasswordRuleResult {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
  };
}

export function passwordMeetsAllRules(password: string): boolean {
  const rules = evaluatePasswordRules(password);
  return rules.minLength && rules.hasUppercase && rules.hasLowercase && rules.hasDigit;
}
