import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Field, ProfileSection } from '@/components/profile/ProfileSection';
import type { ProfileFormValues } from '@/components/profile/profile-form';

interface Props {
  email: string;
}

interface ZoneOption {
  id: string;
  label: string;
}

function offsetLabel(zone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((entry) => entry.type === 'timeZoneName');
    return part ? part.value.replace('GMT', 'UTC') : '';
  } catch {
    return '';
  }
}

function buildZoneOptions(current: string): ZoneOption[] {
  let ids: string[] = [];
  try {
    ids = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    ids = [];
  }
  const all = new Set(ids);
  if (current) all.add(current);
  if (all.size === 0) all.add('UTC');
  return [...all].sort().map((id) => {
    const offset = offsetLabel(id);
    return { id, label: offset ? `${id} (${offset})` : id };
  });
}

export default function AccountSection({ email }: Props) {
  const { t } = useTranslation();
  const {
    register,
    getValues,
    formState: { errors },
  } = useFormContext<ProfileFormValues>();
  // Built once from the loaded zone so the saved value is always selectable.
  const zones = useMemo(() => buildZoneOptions(getValues('timeZone')), [getValues]);

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
      <Field
        label={t('profile.page.account.timeZone')}
        htmlFor="profile-time-zone"
        hint={t('profile.page.account.timeZoneHint')}
        error={errors.timeZone?.message}
        className="sm:max-w-[calc(50%-0.5rem)]"
      >
        <div className="relative">
          <select
            id="profile-time-zone"
            aria-invalid={!!errors.timeZone}
            aria-describedby="profile-time-zone-message"
            className="h-10 w-full appearance-none rounded-field border border-input bg-background pr-9 pl-3 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
            {...register('timeZone')}
          >
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
      </Field>
    </ProfileSection>
  );
}
