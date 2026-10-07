import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Handshake, Users, Video, type LucideIcon } from 'lucide-react';
import { ProfileSection } from '@/components/profile/ProfileSection';
import type { CollaborationType, ProfileFormValues } from '@/components/profile/profile-form';

const OPTIONS: { value: CollaborationType; Icon: LucideIcon; labelKey: string; hintKey: string }[] = [
  { value: 'online', Icon: Video, labelKey: 'profile.page.work.online', hintKey: 'profile.page.work.onlineHint' },
  { value: 'inperson', Icon: Users, labelKey: 'profile.page.work.inPerson', hintKey: 'profile.page.work.inPersonHint' },
  { value: 'both', Icon: Handshake, labelKey: 'profile.page.work.both', hintKey: 'profile.page.work.bothHint' },
];

export default function CollaborationSection() {
  const { t } = useTranslation();
  const { register } = useFormContext<ProfileFormValues>();

  return (
    <ProfileSection title={t('profile.page.work.title')} description={t('profile.page.work.description')}>
      <div role="radiogroup" aria-label={t('profile.page.work.title')} className="grid gap-3 md:grid-cols-3">
        {OPTIONS.map(({ value, Icon, labelKey, hintKey }) => (
          <label
            key={value}
            className="group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-muted has-[:checked]:border-2 has-[:checked]:border-ink has-[:checked]:p-3.75 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
          >
            <input type="radio" value={value} className="sr-only" {...register('collaborationType')} />
            <span className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-md bg-muted text-ink-2">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-full border-2 border-input group-has-[:checked]:border-ink group-has-[:checked]:after:size-2.5 group-has-[:checked]:after:rounded-full group-has-[:checked]:after:bg-ink"
              />
            </span>
            <span className="text-copy font-semibold text-ink">{t(labelKey)}</span>
            <span className="text-meta text-muted-foreground">{t(hintKey)}</span>
          </label>
        ))}
      </div>
    </ProfileSection>
  );
}
