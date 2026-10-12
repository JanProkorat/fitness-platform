import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { OnboardingDataDto } from '@/api/generated';

interface Props {
  onboarding?: OnboardingDataDto;
}

/** Translates one onboarding code; an unknown code is shown as stored. */
function valueLabel(t: TFunction, code: string): string {
  return t(`clients.values.${code}`, { defaultValue: code });
}

/** Translates a comma-separated list of onboarding codes, dropping the "none" marker. */
function listLabel(t: TFunction, raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }
  const labels = raw
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0 && code.toLowerCase() !== 'none')
    .map((code) => valueLabel(t, code));
  return labels.length > 0 ? labels.join(', ') : undefined;
}

function joinParts(parts: Array<string | undefined>): string | undefined {
  const present = parts.filter((part): part is string => Boolean(part));
  return present.length > 0 ? present.join(' • ') : undefined;
}

/** "Client profile" card: injuries and allergies highlighted, key onboarding answers below. */
export default function ClientProfileCard({ onboarding }: Props) {
  const { t, i18n } = useTranslation();
  const formatNumber = (value: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  const injuries = listLabel(t, onboarding?.injuries);
  const allergies = listLabel(t, onboarding?.allergies);

  const rows = onboarding
    ? [
        {
          key: 'diet',
          label: t('clientDetail.overview.profile.diet'),
          value: joinParts([
            onboarding.dietaryStyle ? valueLabel(t, onboarding.dietaryStyle) : undefined,
            onboarding.mealsPerDay ? valueLabel(t, onboarding.mealsPerDay) : undefined,
          ]),
        },
        {
          key: 'training',
          label: t('clientDetail.overview.profile.training'),
          value: joinParts([
            onboarding.currentTrainingFrequency ? valueLabel(t, onboarding.currentTrainingFrequency) : undefined,
            onboarding.desiredTrainingFrequency
              ? t('clientDetail.overview.profile.wants', { value: valueLabel(t, onboarding.desiredTrainingFrequency) })
              : undefined,
          ]),
        },
        {
          key: 'sleep',
          label: t('clientDetail.overview.profile.sleepStress'),
          value: joinParts([
            onboarding.sleepHours != null
              ? t('clientDetail.overview.profile.sleepHours', { hours: formatNumber(onboarding.sleepHours) })
              : undefined,
            onboarding.stressLevel != null
              ? t('clientDetail.overview.profile.stressLevel', { level: onboarding.stressLevel })
              : undefined,
          ]),
        },
        {
          key: 'target',
          label: t('clientDetail.overview.profile.dailyTarget'),
          value: joinParts([
            onboarding.adjustedKcal != null
              ? t('clientDetail.overview.profile.kcal', { value: new Intl.NumberFormat(i18n.language).format(Math.round(onboarding.adjustedKcal)) })
              : undefined,
            onboarding.tdee != null
              ? t('clientDetail.overview.profile.tdee', { value: new Intl.NumberFormat(i18n.language).format(Math.round(onboarding.tdee)) })
              : undefined,
          ]),
        },
        {
          key: 'blockers',
          label: t('clientDetail.overview.profile.pastBlockers'),
          value: listLabel(t, onboarding.pastBlockers),
        },
      ].filter((row): row is { key: string; label: string; value: string } => Boolean(row.value))
    : [];

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4.5 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-copy font-semibold text-ink">{t('clientDetail.overview.profile.heading')}</h2>
        <span className="text-meta text-muted-foreground">{t('clientDetail.overview.profile.source')}</span>
      </div>

      {!onboarding && <p className="text-meta text-muted-foreground">{t('clientDetail.overview.profile.empty')}</p>}

      {onboarding && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 rounded-field bg-training-soft px-3 py-2.5 text-training-ink">
              <span className="text-label font-bold tracking-label uppercase">
                {t('clientDetail.overview.profile.injuries')}
              </span>
              <span className="text-body font-semibold">{injuries ?? t('clientDetail.overview.profile.noneReported')}</span>
            </div>
            <div className="flex flex-col gap-0.5 rounded-field bg-training-soft px-3 py-2.5 text-training-ink">
              <span className="text-label font-bold tracking-label uppercase">
                {t('clientDetail.overview.profile.allergies')}
              </span>
              <span className="text-body font-semibold">{allergies ?? t('clientDetail.overview.profile.noneReported')}</span>
            </div>
          </div>

          {rows.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
              {rows.map((row) => (
                <div key={row.key} className="contents">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium text-ink">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </div>
  );
}
