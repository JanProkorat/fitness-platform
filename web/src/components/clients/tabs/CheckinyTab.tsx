import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useMarkCheckInReviewed, weeklyCheckInKeys } from '@/hooks/useWeeklyCheckIns';
import { CheckInFlagChips } from '@/components/weekly-checkin/CheckInFlagChips';
import { OverrideDialog } from '@/components/profile/OverrideDialog';
import {
  getClientCurrentCheckIn,
  getCheckInSettings,
  getCheckInOverrides,
  type CheckInOverrideDto,
  type CheckInSettingDto,
  DAY_OF_WEEK_KEYS,
  formatTimeDisplay,
} from '@/api/weekly-checkins';

interface CheckinyTabProps {
  /** Client's ApplicationUser Id (Guid string) — passed to check-in endpoints. */
  clientUserId: string;
  /** Client's first name — used to build a human-readable override-dialog title. */
  clientFirstName: string;
  /** Client's last name — used to build a human-readable override-dialog title. */
  clientLastName: string;
}

/** Formats an ISO string to a short localised date. */
function formatShortDate(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Formats an ISO string to a date + time display. */
function formatDateTimeStr(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CheckinyTab({
  clientUserId,
  clientFirstName,
  clientLastName,
}: CheckinyTabProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [overrideTarget, setOverrideTarget] = useState<CheckInOverrideDto | null>(null);

  // Current-week check-in(s) for this client
  const {
    data: checkInResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: weeklyCheckInKeys.clientCurrent(clientUserId),
    queryFn: () => getClientCurrentCheckIn(clientUserId),
    enabled: Boolean(clientUserId),
    retry: false,
  });

  const { mutate: markReviewed, isPending: isMarkingReviewed } = useMarkCheckInReviewed();

  // Settings + overrides for OverrideDialog and schedule description
  const { data: settingsResponse } = useQuery({
    queryKey: ['weekly-checkin-settings'],
    queryFn: getCheckInSettings,
  });
  const { data: overridesResponse } = useQuery({
    queryKey: ['weekly-checkin-overrides'],
    queryFn: getCheckInOverrides,
  });

  const settings: CheckInSettingDto[] = settingsResponse?.settings ?? [];
  const overrides: CheckInOverrideDto[] = overridesResponse?.overrides ?? [];
  const items = checkInResponse?.checkIns ?? [];

  // Resolve header schedule description from Training profession
  const trainingOverride = overrides.find(
    (o) => o.clientUserId === clientUserId && o.profession === 'Training',
  );
  const trainingSetting = settings.find((s) => s.profession === 'Training');
  const effectiveDay = trainingOverride?.dayOfWeek ?? trainingSetting?.dayOfWeek ?? null;
  const effectiveTime = trainingOverride?.timeOfDay ?? trainingSetting?.timeOfDay ?? null;
  const scheduleDesc =
    effectiveDay != null && effectiveTime != null
      ? `${t(`weeklyCheckIn.day.${DAY_OF_WEEK_KEYS[effectiveDay]}`)} ${formatTimeDisplay(effectiveTime)}`
      : null;

  /** Constructs a minimal override DTO so OverrideDialog can open for new overrides. */
  function getOverrideForProfession(profession: 'Training' | 'Nutrition'): CheckInOverrideDto {
    const existing = overrides.find(
      (o) => o.clientUserId === clientUserId && o.profession === profession,
    );
    if (existing) return existing;
    return {
      id: '',
      clientUserId,
      clientFirstName,
      clientLastName,
      profession,
      dayOfWeek: null,
      timeOfDay: null,
      enabled: null,
      addendum: null,
      deadlineOffsetHours: null,
    };
  }

  if (isLoading) {
    return (
      <div id="cl-pane-checkiny">
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('common.loading')}
        </div>
      </div>
    );
  }

  return (
    <div id="cl-pane-checkiny">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[15px] font-semibold text-text">
            {t('clientDetail.checkiny.title')}
          </div>
          {scheduleDesc && (
            <div className="text-[12px] text-text3 mt-0.5">
              {t('clientDetail.checkiny.scheduleDesc', { schedule: scheduleDesc })}
            </div>
          )}
        </div>
        <button
          type="button"
          className="text-[13px] font-medium text-text2 border border-border rounded-[var(--radius-sm)] px-3 py-1.5 hover:bg-bg-hover transition-colors shrink-0"
          onClick={() => setOverrideTarget(getOverrideForProfession('Training'))}
        >
          {t('clientDetail.checkiny.scheduleButton')}
        </button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="text-[13px] text-text3 py-12 text-center">
          {t('clientDetail.checkiny.errorLoading')}
        </div>
      )}

      {/* Empty state */}
      {!isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="text-[32px] opacity-40">📋</div>
          <div className="text-[14px] font-medium text-text2">
            {t('clientDetail.checkiny.emptyTitle')}
          </div>
          <div className="text-[13px] text-text3 max-w-xs">
            {t('clientDetail.checkiny.emptyDescription')}
          </div>
        </div>
      )}

      {/* Check-in rows */}
      {!isError && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((checkIn) => {
            const hasResponded = Boolean(checkIn.respondedAt);
            const isReviewed = Boolean(checkIn.reviewedByTrainerAt);
            const professionLabel =
              checkIn.profession === 'Training'
                ? t('weeklyCheckIn.professionTraining')
                : t('weeklyCheckIn.professionNutrition');

            if (hasResponded) {
              // Completed row — solid border
              return (
                <div
                  key={checkIn.id}
                  className="border border-border rounded-[var(--radius-lg)] px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-accent-bg text-accent border border-accent-br">
                        {professionLabel}
                      </span>
                      <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-green-bg text-green border border-[var(--green-br)]">
                        {t('clientDetail.checkiny.statusCompleted')}
                      </span>
                      {isReviewed && (
                        <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-medium bg-bg3 text-text3">
                          ✓ {t('weeklyCheckIn.plan.reviewedPill')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text3 whitespace-nowrap shrink-0">
                      {formatShortDate(checkIn.weekStartDate, lang)}
                    </div>
                  </div>

                  <div className="text-[12px] text-text3 mb-2">
                    {t('weeklyCheckIn.plan.bannerResponded', {
                      submittedAt: formatDateTimeStr(checkIn.respondedAt!, lang),
                    })}
                  </div>

                  {checkIn.flags.length > 0 && (
                    <div className="mb-2">
                      <CheckInFlagChips flags={checkIn.flags} />
                    </div>
                  )}

                  {checkIn.note && (
                    <p className="text-[12px] text-text2 leading-relaxed border-l-2 border-accent pl-2.5 mb-2">
                      {checkIn.note}
                    </p>
                  )}

                  {!isReviewed && (
                    <button
                      type="button"
                      disabled={isMarkingReviewed}
                      onClick={() => markReviewed(checkIn.id)}
                      className="mt-1 text-[12px] font-medium text-accent border border-accent-br rounded-[var(--radius-sm)] px-3 py-1 hover:bg-accent-bg transition-colors disabled:opacity-50"
                    >
                      {isMarkingReviewed
                        ? t('common.saving')
                        : t('weeklyCheckIn.plan.markReviewed')}
                    </button>
                  )}
                </div>
              );
            }

            // Pending row — dashed border
            return (
              <div
                key={checkIn.id}
                className="rounded-[var(--radius-lg)] px-4 py-3.5"
                style={{ border: '1.5px dashed var(--border)' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-bg3 text-text3">
                      {professionLabel}
                    </span>
                    <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-orange-bg text-orange">
                      {t('clientDetail.checkiny.statusPending')}
                    </span>
                  </div>
                  <div className="text-[11px] text-text3 whitespace-nowrap shrink-0">
                    {formatShortDate(checkIn.weekStartDate, lang)}
                  </div>
                </div>
                <div className="text-[12px] text-text3">
                  {t('weeklyCheckIn.plan.bannerPending', {
                    sentAt: formatDateTimeStr(checkIn.sentAt, lang),
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OverrideDialog for per-client schedule settings */}
      {overrideTarget && (
        <OverrideDialog
          override={overrideTarget}
          settings={settings}
          onClose={() => setOverrideTarget(null)}
        />
      )}
    </div>
  );
}
