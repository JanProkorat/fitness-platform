import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { ProfileSection } from '@/components/profile/ProfileSection';
import type { ProfileFormValues } from '@/components/profile/profile-form';

const ROWS = [
  { name: 'showInSearch', labelKey: 'profile.page.visibility.showInSearch', hintKey: 'profile.page.visibility.showInSearchHint' },
  { name: 'acceptNewClients', labelKey: 'profile.page.visibility.acceptNewClients', hintKey: 'profile.page.visibility.acceptNewClientsHint' },
] as const;

export default function VisibilitySection() {
  const { t } = useTranslation();
  const { control } = useFormContext<ProfileFormValues>();

  return (
    <ProfileSection title={t('profile.page.visibility.title')} description={t('profile.page.visibility.description')}>
      <div className="flex flex-col border-t border-border">
        {ROWS.map(({ name, labelKey, hintKey }) => (
          <div key={name} className="flex items-center justify-between gap-4 border-b border-border py-3.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span id={`profile-${name}-label`} className="text-copy font-semibold text-ink">
                {t(labelKey)}
              </span>
              <span id={`profile-${name}-hint`} className="text-body text-muted-foreground">
                {t(hintKey)}
              </span>
            </div>
            <Controller
              control={control}
              name={name}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-labelledby={`profile-${name}-label`}
                  aria-describedby={`profile-${name}-hint`}
                />
              )}
            />
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}
