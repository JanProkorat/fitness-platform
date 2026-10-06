import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { evaluatePasswordRules } from '@/lib/password-rules';

interface PasswordStrengthBarProps {
  password: string;
  /** Element id so the password input can reference the hint via aria-describedby. */
  id?: string;
}

const STRENGTH_KEYS = ['weak', 'weak', 'fair', 'good', 'strong'] as const;
const SEGMENTS = 4;

/**
 * Four-segment strength bar plus a one-line hint. One segment per password
 * rule met (lib/password-rules), so the bar and the server rules never
 * disagree: all four segments means the password is accepted.
 */
export default function PasswordStrengthBar({ password, id }: PasswordStrengthBarProps) {
  const { t } = useTranslation();
  const rules = evaluatePasswordRules(password);
  const met = [rules.minLength, rules.hasUppercase, rules.hasLowercase, rules.hasDigit].filter(
    Boolean
  ).length;
  const hint = t('entry.register.passwordHint');

  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="flex gap-1 pt-0.5">
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full',
              index < met ? (met <= 1 ? 'bg-error' : 'bg-success') : 'bg-line'
            )}
          />
        ))}
      </div>
      <p id={id} className={cn('text-meta text-muted-foreground', met === 0 && 'first-letter:uppercase')}>
        {met > 0 ? `${t(`entry.register.passwordStrength.${STRENGTH_KEYS[met]}`)} · ` : ''}
        {hint}
      </p>
    </div>
  );
}
