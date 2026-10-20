import { useTranslation } from 'react-i18next';
import { PanelFactsCard, type PanelFact } from '@/components/inbox/panel/PanelPrimitives';
import { formatCardDate } from '@/lib/cooperationCards';
import type { IncomingClientRequestDto } from '@/api/generated';

interface Props {
  request: IncomingClientRequestDto;
}

/** "Sedentary" -> "sedentary", the casing of the shared `nutritionGoals.<level>` labels. */
function activityKey(level: string): string {
  return `nutritionGoals.${level.charAt(0).toLowerCase()}${level.slice(1)}`;
}

/**
 * The requester's onboarding answers from the incoming request: goal, height,
 * weight and activity, reusing the goal / activity labels the client page uses.
 * Rows without an answer are left out.
 */
export default function OnboardingAnswersCard({ request }: Props) {
  const { t, i18n } = useTranslation();
  const facts: PanelFact[] = [];

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

  return (
    <PanelFactsCard
      testId="onboarding-answers-card"
      title={t('inbox.panel.onboarding.title')}
      aside={request.sentAt ? formatSentDay(request.sentAt, i18n.language, t('inbox.panel.onboarding.today')) : undefined}
      facts={facts}
    >
      <p className="pb-4 text-body text-muted-foreground">{t('inbox.panel.onboarding.empty')}</p>
    </PanelFactsCard>
  );
}

function formatSentDay(iso: string, locale: string, todayLabel: string): string {
  return new Date(iso).toDateString() === new Date().toDateString() ? todayLabel : formatCardDate(iso, locale);
}
