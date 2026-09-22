import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import ClientStatusBadge from '@/components/clients/ClientStatusBadge';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
  /**
   * `h1` on the client-detail page header (the page's own title); `h2` in
   * the inbox's "Show client" panel, which is not the page title there.
   */
  headingLevel?: 'h1' | 'h2';
  className?: string;
}

/** Age in whole years, computed from a birthdate that hasn't necessarily occurred yet this year. */
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

/**
 * Name + status pill + dot-separated meta line (age • sex • height) + a
 * bordered goal chip — extracted from `ClientDetailHeader` (#1094) so the
 * inbox's "Show client" panel (#1095) can reuse it verbatim instead of a
 * second copy. Deliberately carries no left indent of its own: the
 * client-detail header supplies that by wrapping this block next to its
 * back-arrow link in a shared flex row, so both of this block's internal
 * rows (name and meta) line up under each other automatically. The panel
 * has no back arrow, so it renders flush left with no extra wrapper needed.
 */
export default function ClientIdentityBlock({ dashboard, headingLevel = 'h1', className }: Props) {
  const { t } = useTranslation();
  const Heading = headingLevel;

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
        <Heading className="text-title font-bold text-ink">
          {dashboard.firstName} {dashboard.lastName}
        </Heading>
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
