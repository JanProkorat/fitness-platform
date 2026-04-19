import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { CheckInFlagChips } from './CheckInFlagChips';
import { useClientCurrentCheckIn, useMarkCheckInReviewed } from '@/hooks/useWeeklyCheckIns';
import type { Profession, ClientCheckInDto } from '@/api/weekly-checkins';

interface CheckInBannerProps {
  clientUserId: string;
  profession: Profession;
}

/** Formats an ISO datetime string for localized display. */
function formatDate(isoString: string, language: string): string {
  try {
    return new Date(isoString).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/** Inner banner for a single check-in record. */
function CheckInBannerInner({
  checkIn,
  language,
}: {
  checkIn: ClientCheckInDto;
  language: string;
}) {
  const { t } = useTranslation();
  const { mutate: markReviewed, isPending } = useMarkCheckInReviewed();

  const hasResponded = checkIn.respondedAt !== null;
  const isReviewed = checkIn.reviewedByTrainerAt !== null;

  // Collapsed "Reviewed" pill — shown after trainer marks reviewed
  if (isReviewed) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-md bg-bg2 text-[12px] text-text2"
        role="status"
      >
        <span className="text-green font-medium">✓</span>
        <span>{t('weeklyCheckIn.plan.reviewedPill')}</span>
      </div>
    );
  }

  if (!hasResponded) {
    // Pending state: reminder sent but client hasn't responded
    return (
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-md border border-border-md bg-bg2 text-[13px] text-text2"
        role="status"
      >
        <span className="text-lg shrink-0">📋</span>
        <span>
          {t('weeklyCheckIn.plan.bannerPending', {
            sentAt: formatDate(checkIn.sentAt, language),
          })}
        </span>
      </div>
    );
  }

  // Responded state: show flags + note + mark-reviewed button
  return (
    <div
      className="flex flex-col gap-2 px-4 py-3 rounded-md border border-accent-br bg-accent-bg"
      role="region"
      aria-label={t('weeklyCheckIn.plan.bannerResponded', {
        submittedAt: formatDate(checkIn.respondedAt!, language),
      })}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg shrink-0">📋</span>
          <span className="text-[13px] font-semibold text-text">
            {t('weeklyCheckIn.plan.bannerResponded', {
              submittedAt: formatDate(checkIn.respondedAt!, language),
            })}
          </span>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() => markReviewed(checkIn.id)}
        >
          {isPending ? t('common.saving') : t('weeklyCheckIn.plan.markReviewed')}
        </Button>
      </div>

      {/* Flags */}
      {checkIn.flags.length > 0 && <CheckInFlagChips flags={checkIn.flags} />}

      {/* Note */}
      {checkIn.note && (
        <p className="text-[12px] text-text2 leading-relaxed border-l-2 border-accent pl-2.5 ml-0.5">
          {checkIn.note}
        </p>
      )}
    </div>
  );
}

/**
 * Banner shown at the top of plan editor pages (nutrition + training).
 *
 * Fetches the current check-in for the given client + profession.
 * Hidden entirely when no check-in exists for this week.
 */
export function CheckInBanner({ clientUserId, profession }: CheckInBannerProps) {
  const { i18n } = useTranslation();
  const { data: checkIns, isLoading } = useClientCurrentCheckIn(clientUserId, profession);

  // Hide while loading to avoid layout shift
  if (isLoading) return null;

  const checkIn = checkIns[0] ?? null;

  // No check-in for this week — banner hidden
  if (!checkIn) return null;

  return (
    <div className="px-4 pt-3 pb-1 shrink-0">
      <CheckInBannerInner checkIn={checkIn} language={i18n.language} />
    </div>
  );
}
