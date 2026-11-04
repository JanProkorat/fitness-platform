import { useTranslation } from 'react-i18next';
import { History } from 'lucide-react';
import type { IncomingClientRequestDto } from '@/api/generated';

interface Props {
  request: IncomingClientRequestDto;
  clientName: string;
}

/** "Sedentary" -> "nutritionGoals.sedentary", the casing of the shared activity labels. */
function activityKey(level: string): string {
  return `nutritionGoals.${level.charAt(0).toLowerCase()}${level.slice(1)}`;
}

interface Fact {
  label: string;
  value: string;
}

/** The "About Adam" block: the client's message, their onboarding facts and, when shared, a history summary. */
export default function AboutSection({ request, clientName }: Props) {
  const { t } = useTranslation();
  const facts: Fact[] = [];
  if (request.primaryGoal) {
    facts.push({
      label: t('inbox.panel.onboarding.goal'),
      value: t(`nutritionGoals.goal_${request.primaryGoal}`, { defaultValue: request.primaryGoal }),
    });
  }
  if (request.heightCm != null) {
    facts.push({
      label: t('inbox.panel.onboarding.height'),
      value: t('clientDetail.overview.header.heightCm', { cm: request.heightCm }),
    });
  }
  if (request.weightKg != null) {
    facts.push({
      label: t('inbox.panel.weightLabel'),
      value: t('inbox.panel.onboarding.weightKg', { kg: request.weightKg }),
    });
  }
  if (request.derivedActivityLevel) {
    facts.push({
      label: t('inbox.panel.onboarding.activity'),
      value: t(activityKey(request.derivedActivityLevel), { defaultValue: request.derivedActivityLevel }),
    });
  }
  const history = request.shareHistory ? request.history : undefined;

  return (
    <section data-testid="invite-review-about" className="flex flex-col gap-3">
      <h3 className="text-label font-bold tracking-label text-muted-foreground uppercase">
        {t('inviteReview.about', { name: clientName })}
      </h3>
      {request.message && (
        <p className="rounded-field bg-sunken px-3.5 py-3 text-body text-ink">{request.message}</p>
      )}
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="flex min-w-0 flex-col gap-0.5 rounded-field bg-sunken px-3 py-2.5">
              <dt className="text-meta text-muted-foreground">{fact.label}</dt>
              <dd className="truncate text-body font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {history && (
        <p data-testid="invite-review-history" className="flex items-center gap-2 text-body text-muted-foreground">
          <History className="size-4 shrink-0 text-success" aria-hidden="true" />
          {t('inviteReview.history', {
            plans: t('inviteReview.historyPlans', { count: history.planCount ?? 0 }),
            measurements: t('inviteReview.historyMeasurements', { count: history.measurementCount ?? 0 }),
            photos: t('inviteReview.historyPhotos', { count: history.photoCount ?? 0 }),
          })}
        </p>
      )}
    </section>
  );
}
