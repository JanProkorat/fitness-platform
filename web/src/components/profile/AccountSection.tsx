import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import type { ProfileFormValues } from '@/components/profile/profile-form';

interface Props {
  email: string;
}

export default function AccountSection({ email }: Props) {
  const { t } = useTranslation();
  const {
    register,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();

  return (
    <ProfileSection title={t('profile.page.account.title')} description={t('profile.page.account.description')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('profile.email')} htmlFor="profile-email" hint={t('profile.page.account.emailHint')}>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              aria-describedby="profile-email-message"
              className="h-10 bg-muted pl-9 text-muted-foreground"
            />
          </div>
        </Field>
        <Field
          label={t('profile.phone')}
          htmlFor="profile-phone"
          hint={t('profile.page.account.phoneHint')}
          error={errors.phoneNumber?.message}
        >
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            className="h-10"
            aria-invalid={!!errors.phoneNumber}
            aria-describedby="profile-phone-message"
            {...register('phoneNumber')}
          />
        </Field>
      </div>
    </ProfileSection>
  );
}
