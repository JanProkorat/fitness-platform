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

const CHIP_CLASS =
  'mr-1 mb-0.5 inline-flex h-5 items-center rounded-full border border-border bg-card px-1.5 text-meta font-semibold text-ink-2';
const ALLERGY_CHIP_CLASS =
  'mr-1 mb-0.5 inline-flex h-5 items-center rounded-full border border-error bg-card px-1.5 text-meta font-semibold text-error';

function Row({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <div data-testid={testId} className="flex gap-2.5 text-meta leading-snug">
      <span className="w-23 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 font-semibold text-ink">{children}</span>
    </div>
  );
}

function Chips({ items, className = CHIP_CLASS, emptyLabel }: { items: string[]; className?: string; emptyLabel: string }) {
  if (items.length === 0) {
    return <span className="font-normal text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <ul className="flex flex-wrap">
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
    <section aria-labelledby={headingId} data-testid="about-client" className="flex flex-col gap-2">
      <h2 id={headingId} className="text-label font-bold tracking-label text-ink-2 uppercase">
        {t('clientPlanEditor.info.about.heading', { name: clientFirstName })}
      </h2>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
        {!onboarding && <p className="text-meta text-muted-foreground">{t('clientDetail.nutrition.profile.empty')}</p>}

        {onboarding && (
          <>
            {onboarding.primaryGoal != null && (
              <Row label={t('clientPlanEditor.info.about.goal')} testId="about-goal">
                {value(onboarding.primaryGoal)}
              </Row>
            )}
            {onboarding.dietaryStyle != null && (
              <Row label={t('clientPlanEditor.info.about.diet')} testId="about-diet">
                {value(onboarding.dietaryStyle)}
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
                {onboarding.habits.length === 0 ? (
                  <span className="font-normal text-muted-foreground">{none}</span>
                ) : (
                  onboarding.habits.join(', ')
                )}
              </Row>
            )}
            {onboarding.mealsPerDay != null && (
              <Row label={t('clientPlanEditor.info.about.meals')} testId="about-meals">
                {value(onboarding.mealsPerDay)}
              </Row>
            )}
          </>
        )}

        <Link
          to={`/clients/${clientId}/nutrition`}
          data-testid="about-profile-link"
          className="w-fit rounded-xs text-meta font-semibold text-ink-2 underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('clientPlanEditor.info.about.profileLink', { name: clientFirstName })}
        </Link>
      </div>
    </section>
  );
}
