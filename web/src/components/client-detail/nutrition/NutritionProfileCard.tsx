import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { OnboardingDataDto } from '@/api/generated';
import EditNutritionProfileDialog from '@/components/client-detail/nutrition/EditNutritionProfileDialog';
import { splitAllergies } from '@/components/client-detail/nutrition/nutritionProfile';

interface Props {
  clientId: string;
  clientFirstName: string;
  /** Undefined until the client has onboarding answers. */
  onboarding?: OnboardingDataDto;
}

const CHIP_CLASS = 'rounded-full border border-border bg-card px-3 py-1 text-body font-medium text-ink';
const ALLERGY_CHIP_CLASS = 'rounded-full border border-error bg-card px-3 py-1 text-body font-medium text-error';

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label font-bold tracking-label text-muted-foreground uppercase">{label}</h3>
      {children}
    </div>
  );
}

function ChipList({ items, className = CHIP_CLASS, emptyLabel }: { items: string[]; className?: string; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-body text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item, index) => (
        <li key={`${index}-${item}`} className={className}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** "Nutrition profile" card: targets, allergies, dislikes and habits taken from the client's onboarding. */
export default function NutritionProfileCard({ clientId, clientFirstName, onboarding }: Props) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const [editing, setEditing] = useState(false);
  const locale = i18n.language;

  const formatKcal = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const formatGrams = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

  const targets: string[] = [];
  if (onboarding) {
    if (onboarding.adjustedKcal != null) {
      targets.push(t('clientDetail.nutrition.profile.kcal', { value: formatKcal(onboarding.adjustedKcal) }));
    }
    if (onboarding.proteinGrams != null) {
      targets.push(t('clientDetail.nutrition.profile.protein', { value: formatGrams(onboarding.proteinGrams) }));
    }
    if (onboarding.carbsGrams != null) {
      targets.push(t('clientDetail.nutrition.profile.carbs', { value: formatGrams(onboarding.carbsGrams) }));
    }
    if (onboarding.fatGrams != null) {
      targets.push(t('clientDetail.nutrition.profile.fat', { value: formatGrams(onboarding.fatGrams) }));
    }
    if (onboarding.fibreGrams != null) {
      targets.push(t('clientDetail.nutrition.profile.fibre', { value: formatGrams(onboarding.fibreGrams) }));
    }
  }

  const allergies = splitAllergies(onboarding?.allergies).map((code) =>
    t(`clients.values.${code}`, { defaultValue: code }),
  );

  const footer = onboarding?.dateUpdated
    ? t('clientDetail.nutrition.profile.sourceUpdated', {
        date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(onboarding.dateUpdated)),
      })
    : t('clientDetail.nutrition.profile.source');

  const none = t('clientDetail.nutrition.profile.none');

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-body font-semibold text-ink">
          {t('clientDetail.nutrition.profile.heading', { name: clientFirstName })}
        </h2>
        {onboarding && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="cursor-pointer rounded-xs text-body font-semibold text-ink underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t('clientDetail.nutrition.profile.edit.open')}
          </button>
        )}
      </div>

      {!onboarding && <p className="text-body text-muted-foreground">{t('clientDetail.nutrition.profile.empty')}</p>}

      {onboarding && (
        <>
          <Section label={t('clientDetail.nutrition.profile.targets')}>
            <ChipList items={targets} emptyLabel={t('clientDetail.nutrition.profile.noTargets')} />
          </Section>
          <Section label={t('clientDetail.nutrition.profile.allergies')}>
            <ChipList items={allergies} className={ALLERGY_CHIP_CLASS} emptyLabel={none} />
          </Section>
          <Section label={t('clientDetail.nutrition.profile.dislikes')}>
            <ChipList items={onboarding.dislikes ?? []} emptyLabel={none} />
          </Section>
          <Section label={t('clientDetail.nutrition.profile.habits')}>
            <ChipList items={onboarding.habits ?? []} emptyLabel={none} />
          </Section>
          <p data-testid="nutrition-profile-source" className="text-caption text-muted-foreground">
            {footer}
          </p>
          <EditNutritionProfileDialog
            clientId={clientId}
            onboarding={onboarding}
            open={editing}
            onClose={() => setEditing(false)}
          />
        </>
      )}
    </section>
  );
}
