import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { OnboardingDataDto } from '@/api/generated';
import { splitAllergies } from '@/components/client-detail/nutrition/nutritionProfile';

interface Props {
  clientId: string;
  clientFirstName: string;
  /** Undefined until the client has onboarding answers. */
  onboarding?: OnboardingDataDto;
}

const CHIP_CLASS = 'rounded-full border border-border bg-card px-3 py-1 text-body font-medium text-ink';
const ALLERGY_CHIP_CLASS = 'rounded-full border border-error bg-card px-3 py-1 text-body font-medium text-error';

function Row({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="flex flex-col gap-1.5">
      <h3 className="text-label font-bold tracking-label text-muted-foreground uppercase">{label}</h3>
      {children}
    </div>
  );
}

function Chips({ items, className = CHIP_CLASS, emptyLabel }: { items: string[]; className?: string; emptyLabel: string }) {
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

/**
 * Read-only summary of the client's onboarding for the plan editor. Fields the server leaves out (no
 * nutrition-plan capability) hide their row.
 */
export default function AboutClientCard({ clientId, clientFirstName, onboarding }: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const none = t('clientDetail.nutrition.profile.none');
  const value = (code: string) => t(`clients.values.${code}`, { defaultValue: code });

  return (
    <section
      aria-labelledby={headingId}
      data-testid="about-client"
      className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4"
    >
      <h2 id={headingId} className="text-body font-semibold text-ink">
        {t('clientPlanEditor.info.about.heading', { name: clientFirstName })}
      </h2>

      {!onboarding && <p className="text-body text-muted-foreground">{t('clientDetail.nutrition.profile.empty')}</p>}

      {onboarding && (
        <>
          {onboarding.primaryGoal != null && (
            <Row label={t('clientPlanEditor.info.about.goal')} testId="about-goal">
              <p className="text-body text-ink">{value(onboarding.primaryGoal)}</p>
            </Row>
          )}
          {onboarding.dietaryStyle != null && (
            <Row label={t('clientPlanEditor.info.about.diet')} testId="about-diet">
              <p className="text-body text-ink">{value(onboarding.dietaryStyle)}</p>
            </Row>
          )}
          {onboarding.allergies != null && (
            <Row label={t('clientPlanEditor.info.about.allergies')} testId="about-allergies">
              <Chips items={splitAllergies(onboarding.allergies).map(value)} className={ALLERGY_CHIP_CLASS} emptyLabel={none} />
            </Row>
          )}
          {onboarding.dislikes != null && (
            <Row label={t('clientPlanEditor.info.about.dislikes')} testId="about-dislikes">
              <Chips items={onboarding.dislikes} emptyLabel={none} />
            </Row>
          )}
          {onboarding.habits != null && (
            <Row label={t('clientPlanEditor.info.about.habits')} testId="about-habits">
              <Chips items={onboarding.habits} emptyLabel={none} />
            </Row>
          )}
          {onboarding.mealsPerDay != null && (
            <Row label={t('clientPlanEditor.info.about.meals')} testId="about-meals">
              <p className="text-body text-ink">{value(onboarding.mealsPerDay)}</p>
            </Row>
          )}
        </>
      )}

      <Link
        to={`/clients/${clientId}/nutrition`}
        data-testid="about-profile-link"
        className="w-fit rounded-xs text-body font-semibold text-ink underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t('clientPlanEditor.info.about.profileLink')}
      </Link>
    </section>
  );
}
