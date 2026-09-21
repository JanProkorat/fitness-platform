import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ClientStatusBadge from '@/components/clients/ClientStatusBadge';
import TbdValue from '@/components/client-detail/TbdValue';
import type { GetClientDashboardResponse } from '@/api/generated';

interface Props {
  dashboard: GetClientDashboardResponse;
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
 * Client-detail page header (#1094): back arrow, full name, status pill,
 * dot-separated meta line (age • sex • height), a bordered goal chip, and
 * four action buttons. All four buttons render disabled with the shell's
 * coming-soon treatment — Chat/Notes have no surface to link to yet
 * (InboxPage is a placeholder, no notes UI exists), Tasks has no backend
 * concept at all (design review, 2026-09-21).
 */
export default function ClientDetailHeader({ dashboard }: Props) {
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
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            to="/clients"
            aria-label={t('clientDetail.overview.backAriaLabel')}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <h1 className="text-title font-bold text-ink">
            {dashboard.firstName} {dashboard.lastName}
          </h1>
          <ClientStatusBadge status={dashboard.status} />
        </div>
        {(metaSegments.length > 0 || goalLabel) && (
          <div className="flex flex-wrap items-center gap-1.5 pl-7">
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

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')}>
          {t('clientDetail.overview.actions.chat')}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')} className="gap-1.5">
          {t('clientDetail.overview.actions.tasks')}
          <TbdValue />
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')}>
          {t('clientDetail.overview.actions.notes')}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled title={t('shell.comingSoon')}>
          {t('clientDetail.overview.actions.info')}
        </Button>
      </div>
    </div>
  );
}
