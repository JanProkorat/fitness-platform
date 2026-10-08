import { useTranslation } from 'react-i18next';
import ClientStatusBadge from '@/components/clients/ClientStatusBadge';
import { calculateAge } from '@/lib/client-metrics';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
}

/** Client name + status pill, then the "age • sex • height" line with the goal chip. */
export default function PanelIdentity({ dashboard }: Props) {
  const { t } = useTranslation();

  const age = dashboard.dateOfBirth ? calculateAge(dashboard.dateOfBirth) : undefined;
  const ageLabel = age != null ? t('clientDetail.ageYears', { count: age }) : undefined;
  const sexLabel = dashboard.onboarding?.sex ? t(`clients.values.${dashboard.onboarding.sex}`) : undefined;
  const heightLabel =
    dashboard.heightCm != null ? t('clientDetail.overview.header.heightCm', { cm: dashboard.heightCm }) : undefined;
  const goalLabel = dashboard.onboarding?.primaryGoal
    ? t(`nutritionGoals.goal_${dashboard.onboarding.primaryGoal}`)
    : undefined;

  const metaSegments = [ageLabel, sexLabel, heightLabel].filter((segment): segment is string => Boolean(segment));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-auth-title font-semibold tracking-heading text-ink">
          {dashboard.firstName} {dashboard.lastName}
        </h2>
        <ClientStatusBadge status={dashboard.status} />
      </div>
      {(metaSegments.length > 0 || goalLabel) && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {metaSegments.length > 0 && <span className="text-body text-muted-foreground">{metaSegments.join(' • ')}</span>}
          {goalLabel && (
            <span className="rounded-full border border-border px-2.5 py-0.75 text-meta text-muted-foreground">
              {goalLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
