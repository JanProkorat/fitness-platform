import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { evaluatePasswordRules } from '@/lib/password-rules';

interface PasswordStrengthRulesProps {
  password: string;
}

/**
 * Live password-rule checklist (prototype `.pwreq`, scratchpad
 * gf-register.html). Exactly the four rules ASP.NET Identity enforces
 * (`Program.cs`) — 8 characters, uppercase, lowercase, digit. No special
 * character row: the backend does not require one (design-review finding).
 */
export default function PasswordStrengthRules({ password }: PasswordStrengthRulesProps) {
  const { t } = useTranslation();
  const rules = evaluatePasswordRules(password);

  const items: { key: string; met: boolean; label: string }[] = [
    { key: 'length', met: rules.minLength, label: t('entry.register.passwordRules.length') },
    {
      key: 'uppercase',
      met: rules.hasUppercase,
      label: t('entry.register.passwordRules.uppercase'),
    },
    {
      key: 'lowercase',
      met: rules.hasLowercase,
      label: t('entry.register.passwordRules.lowercase'),
    },
    { key: 'digit', met: rules.hasDigit, label: t('entry.register.passwordRules.digit') },
  ];

  return (
    <ul aria-live="polite" className="mt-1.5 grid grid-cols-2 gap-x-2.5 gap-y-1">
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            'flex items-center gap-1.5 text-caption',
            item.met ? 'text-green-ink' : 'text-faint'
          )}
        >
          <span className={cn('size-1 rounded-full', item.met ? 'bg-green-ink' : 'bg-faint')} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
