import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import { BIO_MAX, type FromPrice, type ProfileFormValues } from '@/components/profile/profile-form';
import { formatMoney } from '@/lib/money';

interface Props {
  /** The read-only "from" price derived from the coach's packages; null when nothing qualifies. */
  fromPrice: FromPrice | null;
}

export default function AboutSection({ fromPrice }: Props) {
  const { t, i18n } = useTranslation();
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
        <Field label={t('profile.page.about.price')} htmlFor="profile-price" hint={t('profile.page.about.priceHint')}>
          <div
            id="profile-price"
            data-testid="profile-from-price"
            aria-describedby="profile-price-message"
            className="flex h-10 items-center gap-2 rounded-field border border-input bg-sunken px-3 text-copy text-ink"
          >
            <Box className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">
              {fromPrice
                ? t('profile.page.about.priceFrom', {
                    price: formatMoney(fromPrice.amount, fromPrice.currency, i18n.language),
                  })
                : t('profile.page.about.priceNone')}
            </span>
            <Link
              to="/packages"
              className="ml-auto shrink-0 rounded-sm text-body font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {fromPrice ? t('profile.page.about.priceManage') : t('profile.page.about.priceSetUp')}
            </Link>
          </div>
        </Field>
      </div>
    </ProfileSection>
  );
}
