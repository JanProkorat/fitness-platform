import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import { BIO_MAX, type ProfileFormValues } from '@/components/profile/profile-form';

export default function AboutSection() {
  const { t } = useTranslation();
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();
  const bio = useWatch({ control, name: 'bio' });

  return (
    <ProfileSection title={t('profile.page.about.title')} description={t('profile.page.about.description')}>
      <Field
        label={t('profile.bio')}
        htmlFor="profile-bio"
        aside={`${bio.length} / ${BIO_MAX}`}
        hint={t('profile.page.about.bioHint')}
        error={errors.bio?.message}
      >
        <Textarea
          id="profile-bio"
          rows={5}
          aria-invalid={!!errors.bio}
          aria-describedby="profile-bio-message"
          className="min-h-32 resize-y"
          {...register('bio')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('profile.city')}
          htmlFor="profile-city"
          hint={t('profile.page.about.cityHint')}
          error={errors.city?.message}
        >
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="profile-city"
              autoComplete="address-level2"
              className="h-10 pl-9"
              aria-invalid={!!errors.city}
              aria-describedby="profile-city-message"
              {...register('city')}
            />
          </div>
        </Field>
        <Field
          label={t('profile.page.about.price')}
          htmlFor="profile-price"
          hint={t('profile.page.about.priceHint')}
          error={errors.estimatedPrice?.message}
        >
          <Input
            id="profile-price"
            className="h-10"
            aria-invalid={!!errors.estimatedPrice}
            aria-describedby="profile-price-message"
            {...register('estimatedPrice')}
          />
        </Field>
      </div>
    </ProfileSection>
  );
}
