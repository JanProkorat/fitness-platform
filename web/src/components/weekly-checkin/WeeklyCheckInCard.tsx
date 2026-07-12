import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { Tag } from '@/components/ui/Tag';
import { CheckInFlagChips } from './CheckInFlagChips';
import { useTrainerWeeklyCheckIns } from '@/hooks/useWeeklyCheckIns';
import type { TrainerCheckInDto } from '@/api/weekly-checkins';

/** Derives the initials (up to 2 chars) from a full name string. */
function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/**
 * Builds the client-detail route for the card's CTA, landing the trainer
 * directly on the Checkiny tab. Uses clientPublicId (ClientProfile.PublicId)
 * — the id every client-detail link in the app resolves against — not the
 * clientUserId, which 404s against GET /trainer/clients/{id} (#753).
 */
function buildCheckInRoute(checkIn: TrainerCheckInDto): string {
  return `/clients/${checkIn.clientPublicId}?tab=checkiny`;
}

/* ─────────────────────── Individual row ─────────────────────── */

interface CheckInRowProps {
  checkIn: TrainerCheckInDto;
  language: string;
}

function CheckInRow({ checkIn, language }: CheckInRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const initials = nameInitials(checkIn.clientName);
  const professionLabel =
    checkIn.profession === 'Training'
      ? t('weeklyCheckIn.professionTraining')
      : t('weeklyCheckIn.professionNutrition');

  const isExpired = checkIn.status === 'Expired';

  const submittedLabel = checkIn.respondedAt
    ? new Date(checkIn.respondedAt).toLocaleDateString(language, {
        day: 'numeric',
        month: 'short',
      })
    : null;

  const dueAtLabel =
    isExpired && checkIn.dueAt
      ? new Date(checkIn.dueAt).toLocaleDateString(language, {
          day: 'numeric',
          month: 'short',
        })
      : null;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-bg3 text-text2 text-[11px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {initials}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Name + profession pill + expired badge */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[13px] font-medium text-text truncate">{checkIn.clientName}</span>
          <span className="inline-flex items-center px-1.5 py-[1px] rounded-full text-[10px] font-medium bg-accent-bg text-accent border border-accent-br shrink-0">
            {professionLabel}
          </span>
          {isExpired && (
            <Tag variant="gray" className="shrink-0">
              {t('weeklyCheckIn.status.expired')}
            </Tag>
          )}
          {submittedLabel && !isExpired && (
            <span className="text-[11px] text-text3 shrink-0">{submittedLabel}</span>
          )}
        </div>

        {/* Due-at hint when expired */}
        {dueAtLabel && (
          <p className="text-[11px] text-text3 mb-1">
            {t('weeklyCheckIn.today.expiredDueAt', { date: dueAtLabel })}
          </p>
        )}

        {/* Flag chips — compact summary */}
        {checkIn.flags.length > 0 && <CheckInFlagChips flags={checkIn.flags} />}

        {/* Note preview */}
        {checkIn.note && (
          <p className="mt-1 text-[11px] text-text2 truncate">{checkIn.note}</p>
        )}
      </div>

      {/* Open check-in action */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(buildCheckInRoute(checkIn))}
        className="shrink-0"
      >
        {t('weeklyCheckIn.today.openCheckIn')} →
      </Button>
    </div>
  );
}

/* ─────────────────────── Card ─────────────────────── */

/**
 * "Weekly check-ins" card for the trainer dashboard.
 * Shows the trainer's active check-ins (pending, responded, and expired —
 * i.e. not yet dismissed by the client or reviewed by the trainer),
 * regardless of which calendar week they were scheduled for (#751).
 * Hidden when there are no active check-ins at all.
 */
export function WeeklyCheckInCard() {
  const { t, i18n } = useTranslation();
  const { data: checkIns, isLoading } = useTrainerWeeklyCheckIns();

  // Show responded + expired check-ins in the card body; pending/dismissed go to footer count.
  // Expired check-ins are a terminal state the coach should see (no response was ever received).
  const responded = checkIns.filter(
    (c) => c.respondedAt !== null || c.status === 'Expired',
  );
  const noResponseCount = checkIns.filter(
    (c) => c.respondedAt === null && c.dismissedByClientAt === null && c.status === 'Pending',
  ).length;

  if (isLoading) return null;
  // Hide card entirely when there are no active check-ins at all (#751)
  if (checkIns.length === 0) return null;

  return (
    <div
      className="border border-border-md rounded-md overflow-hidden mb-4"
      role="region"
      aria-label={t('weeklyCheckIn.today.cardTitle')}
    >
      {/* Card header */}
      <div className="flex items-center px-4 py-2.5 border-b border-border bg-bg2">
        <span className="text-[12px] font-semibold text-text uppercase tracking-wide">
          {t('weeklyCheckIn.today.cardTitle')}
        </span>
      </div>

      {/* Responded rows */}
      {responded.length > 0 ? (
        <div className="px-4">
          {responded.map((checkIn) => (
            <CheckInRow key={checkIn.id} checkIn={checkIn} language={i18n.language} />
          ))}
        </div>
      ) : (
        <div className="px-4 py-4 text-[13px] text-text3 text-center">
          {t('weeklyCheckIn.today.noRespondedYet')}
        </div>
      )}

      {/* Footer: count of clients who haven't responded */}
      {noResponseCount > 0 && (
        <div className="px-4 py-2.5 border-t border-border bg-bg2 text-[12px] text-text2">
          {t('weeklyCheckIn.today.noResponseCount', { count: noResponseCount })}
        </div>
      )}
    </div>
  );
}
