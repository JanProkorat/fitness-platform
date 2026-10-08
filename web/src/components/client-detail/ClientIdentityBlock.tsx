import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { calculateAge } from '@/lib/client-metrics';
import ClientStatusBadge from '@/components/clients/ClientStatusBadge';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
  className?: string;
}

/**
 * Name + status pill + dot-separated meta line (age • sex • height) + a
 * bordered goal chip. Deliberately carries no left indent of its own: the
 * client-detail header supplies that by wrapping this block next to its
 * back-arrow link in a shared flex row, so both of this block's internal
 * rows (name and meta) line up under each other automatically.
 */
export default function ClientIdentityBlock({ dashboard, className }: Props) {
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
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <h1 className="text-title font-bold text-ink">
          {dashboard.firstName} {dashboard.lastName}
        </h1>
        <ClientStatusBadge status={dashboard.status} />
      </div>
      {(metaSegments.length > 0 || goalLabel) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {metaSegments.length > 0 && (
            <span className="text-body text-muted-foreground">{metaSegments.join(' • ')}</span>
          )}
          {goalLabel && (
            <span
              className={cn(
                'rounded-full border border-border px-2 py-0.5 text-caption text-muted-foreground',
                metaSegments.length > 0 && 'ml-1',
              )}
            >
              {goalLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
