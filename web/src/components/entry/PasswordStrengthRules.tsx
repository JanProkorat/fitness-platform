import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { evaluatePasswordRules } from '@/lib/password-rules';

interface PasswordStrengthRulesProps {
  password: string;
}

/**
 * Live checklist of the four rules ASP.NET Identity enforces (`Program.cs`):
 * 8 characters, uppercase, lowercase, digit. Sunken 2x2 box; each row shows a
 * check once met and a dot until then, with the state spelled out for screen
 * readers.
 */
export default function PasswordStrengthRules({ password }: PasswordStrengthRulesProps) {
  const { t } = useTranslation();
  const rules = evaluatePasswordRules(password);

  const items: { key: string; met: boolean }[] = [
    { key: 'length', met: rules.minLength },
    { key: 'uppercase', met: rules.hasUppercase },
    { key: 'lowercase', met: rules.hasLowercase },
    { key: 'digit', met: rules.hasDigit },
  ];

  return (
    <ul
      aria-label={t('entry.resetPassword.rules.label')}
      className="grid grid-cols-2 gap-2 rounded-xl bg-sunken px-3.5 py-3"
    >
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            'flex items-center gap-1.75 text-caption',
            item.met ? 'text-ink' : 'text-muted-foreground'
          )}
        >
          <span className={cn('flex', item.met ? 'text-success-ink' : 'text-muted-foreground')}>
            {item.met ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            )}
          </span>
          {t(`entry.resetPassword.rules.${item.key}`)}
          <span className="sr-only">
            {item.met ? t('entry.resetPassword.rules.met') : t('entry.resetPassword.rules.notMet')}
          </span>
        </li>
      ))}
    </ul>
  );
}
