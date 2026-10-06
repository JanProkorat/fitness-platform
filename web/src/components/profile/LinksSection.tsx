import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Briefcase, Camera, Globe, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import type { ProfileFormValues } from '@/components/profile/profile-form';

const LINKS: {
  name: 'website' | 'instagram' | 'linkedIn';
  Icon: LucideIcon;
  labelKey: string;
  placeholderKey: string;
  autoComplete?: string;
}[] = [
  { name: 'website', Icon: Globe, labelKey: 'profile.website', placeholderKey: 'profile.page.links.websitePlaceholder' },
  { name: 'instagram', Icon: Camera, labelKey: 'profile.instagram', placeholderKey: 'profile.page.links.instagramPlaceholder' },
  { name: 'linkedIn', Icon: Briefcase, labelKey: 'profile.linkedin', placeholderKey: 'profile.page.links.linkedinPlaceholder' },
];

export default function LinksSection() {
  const { t } = useTranslation();
  const {
    register,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();

  return (
    <ProfileSection title={t('profile.page.links.title')} description={t('profile.page.links.description')}>
      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map(({ name, Icon, labelKey, placeholderKey }) => {
          const id = `profile-${name}`;
          return (
            <Field key={name} label={t(labelKey)} htmlFor={id} error={errors[name]?.message}>
              <div className="relative">
                <Icon
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={id}
                  placeholder={t(placeholderKey)}
                  className="h-10 pl-9"
                  aria-invalid={!!errors[name]}
                  aria-describedby={`${id}-message`}
                  {...register(name)}
                />
              </div>
            </Field>
          );
        })}
      </div>
    </ProfileSection>
  );
}
