import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type RegistrableRole = 'Trainer' | 'Nutritionist';

const ROLE_IDS: RegistrableRole[] = ['Trainer', 'Nutritionist'];

interface RoleSelectorProps {
  value: RegistrableRole[];
  onChange: (roles: RegistrableRole[]) => void;
  error?: string;
}

/**
 * Register-form role picker (prototype `.roles` / `.role`, scratchpad
 * gf-register.html). Trainer and Nutritionist only — Client is never
 * offered here (clients arrive by invite and use the mobile app, see
 * `RegisterValidator.cs`'s rejection of Client combined with a coach
 * role). Both may be selected at once: the backend takes a list and the
 * platform supports dual-role professionals (design-review finding #2).
 */
export default function RoleSelector({ value, onChange, error }: RoleSelectorProps) {
  const { t } = useTranslation();

  const toggle = (role: RegistrableRole) => {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-meta font-medium text-ink-2">{t('entry.register.roleLabel')}</span>
      <div
        role="group"
        aria-label={t('entry.register.roleLabel')}
        aria-describedby={error ? 'entry-role-error' : undefined}
        className="grid grid-cols-2 gap-2.5"
      >
        {ROLE_IDS.map((role) => {
          const selected = value.includes(role);
          return (
            <button
              key={role}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(role)}
              className={cn(
                'flex flex-col gap-0.5 rounded-md border border-border bg-surface p-3 text-left',
                selected && 'border-brand bg-green-soft'
              )}
            >
              <span className="flex items-center gap-1.5 text-meta font-semibold text-ink">
                <span
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border border-border bg-surface text-primary-foreground',
                    selected && 'border-brand bg-brand'
                  )}
                >
                  {selected && <CheckIcon className="size-2.5" />}
                </span>
                {t(`entry.register.roles.${role.toLowerCase()}.name`)}
              </span>
              <span className="text-caption text-muted-foreground">
                {t(`entry.register.roles.${role.toLowerCase()}.description`)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-caption text-faint">{t('entry.register.roleHint')}</p>
      {error && (
        <p id="entry-role-error" className="text-meta text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
