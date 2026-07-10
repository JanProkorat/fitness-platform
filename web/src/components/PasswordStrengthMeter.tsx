import { cn } from '@/lib/cn';
import { computePasswordStrength, strengthClass } from '@/lib/password-strength';

interface PasswordStrengthMeterProps {
  password: string;
}

/**
 * 4-bar password strength indicator shared between the registration wizard
 * (RegisterStep2) and ResetPasswordPage — both rendered the same markup with
 * slightly different indexing before this extraction (#687).
 */
export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = computePasswordStrength(password);

  if (password.length === 0) {
    return null;
  }

  return (
    <div className="auth-strength">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn('auth-strength-bar', i <= strength && strengthClass(strength))}
        />
      ))}
    </div>
  );
}
