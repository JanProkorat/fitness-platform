import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { CheckInFlagChips } from './CheckInFlagChips';
import { useClientCurrentCheckIn, useMarkCheckInReviewed } from '@/hooks/useWeeklyCheckIns';
import {
  getCheckInOverrides,
  getCheckInSettings,
  type CheckInOverrideDto,
  type CheckInSettingDto,
} from '@/api/weekly-checkins';
import { useQuery } from '@tanstack/react-query';
import { OverrideDialog } from '@/components/profile/OverrideDialog';

interface WeeklyCheckInSectionProps {
  /** The client's ApplicationUser Id (Guid string) — used as route param. */
  clientUserId: string;
}

/** Formats an ISO datetime for display. */
function formatDateTime(isoString: string, language: string): string {
  try {
    return new Date(isoString).toLocaleDateString(language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/**
 * "Weekly check-in · this week" section shown on the client detail page.
 *
 * Displays the latest check-in for either profession (or both if present).
 * Includes a "Mark reviewed" button and an "Override settings" button.
 */
export function WeeklyCheckInSection({ clientUserId }: WeeklyCheckInSectionProps) {
  const { t, i18n } = useTranslation();
  const [overrideTarget, setOverrideTarget] = useState<CheckInOverrideDto | null>(null);

  const { data: checkIns, isLoading } = useClientCurrentCheckIn(clientUserId);
  const { mutate: markReviewed, isPending: isMarkingReviewed } = useMarkCheckInReviewed();

  // Load settings + overrides for the OverrideDialog
  const { data: settingsResponse } = useQuery({
    queryKey: ['weekly-checkin-settings'],
    queryFn: getCheckInSettings,
  });
  const { data: overridesResponse } = useQuery({
    queryKey: ['weekly-checkin-overrides'],
    queryFn: getCheckInOverrides,
  });

  if (isLoading) return null;
  if (!checkIns || checkIns.length === 0) return null;

  const settings: CheckInSettingDto[] = settingsResponse?.settings ?? [];
  const overrides: CheckInOverrideDto[] = overridesResponse?.overrides ?? [];

  /** Finds the override DTO for this client + profession, or constructs a minimal one. */
  function getOverrideForProfession(profession: 'Training' | 'Nutrition'): CheckInOverrideDto {
    const existing = overrides.find(
      (o) => o.clientUserId === clientUserId && o.profession === profession,
    );
    if (existing) return existing;

    // Construct a "use-defaults" override DTO so the dialog can still open
    const parts = clientUserId.split('-');
    return {
      id: '',
      clientUserId,
      clientFirstName: parts[0] ?? '',
      clientLastName: '',
      profession,
      dayOfWeek: null,
      timeOfDay: null,
      enabled: null,
      addendum: null,
      deadlineOffsetHours: null,
    };
  }

  return (
    <div className="mt-5">
      {/* Section heading */}
      <h2 className="text-[13px] font-semibold text-text uppercase tracking-wide mb-3">
        {t('weeklyCheckIn.clientDetail.title')}
      </h2>

      <div className="flex flex-col gap-3">
        {checkIns.map((checkIn) => {
          const professionLabel =
            checkIn.profession === 'Training'
              ? t('weeklyCheckIn.professionTraining')
              : t('weeklyCheckIn.professionNutrition');
          const hasResponded = checkIn.respondedAt !== null;
          const isReviewed = checkIn.reviewedByTrainerAt !== null;

          return (
            <div
              key={checkIn.id}
              className="border border-border-md rounded-md p-4"
            >
              {/* Row header: profession + reviewed badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[11px] font-medium bg-accent-bg text-accent border border-accent-br">
                    {professionLabel}
                  </span>
                  {isReviewed && (
                    <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-medium bg-green-bg text-green border border-[var(--green-br)]">
                      ✓ {t('weeklyCheckIn.plan.reviewedPill')}
                    </span>
                  )}
                </div>
                {/* Override settings button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOverrideTarget(getOverrideForProfession(checkIn.profession))}
                >
                  {t('weeklyCheckIn.clientDetail.overrideSettings')}
                </Button>
              </div>

              {!hasResponded ? (
                /* Pending state */
                <p className="text-[13px] text-text2">
                  {t('weeklyCheckIn.plan.bannerPending', {
                    sentAt: formatDateTime(checkIn.sentAt, i18n.language),
                  })}
                </p>
              ) : (
                /* Responded state */
                <div className="flex flex-col gap-2">
                  {/* Submitted at */}
                  <p className="text-[12px] text-text3">
                    {t('weeklyCheckIn.plan.bannerResponded', {
                      submittedAt: formatDateTime(checkIn.respondedAt!, i18n.language),
                    })}
                  </p>

                  {/* Flags */}
                  {checkIn.flags.length > 0 && <CheckInFlagChips flags={checkIn.flags} />}

                  {/* Note */}
                  {checkIn.note && (
                    <p className="text-[12px] text-text2 leading-relaxed border-l-2 border-accent pl-2.5">
                      {checkIn.note}
                    </p>
                  )}

                  {/* Mark reviewed button */}
                  {!isReviewed && (
                    <div className="mt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={isMarkingReviewed}
                        onClick={() => markReviewed(checkIn.id)}
                      >
                        {isMarkingReviewed ? t('common.saving') : t('weeklyCheckIn.plan.markReviewed')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Override dialog */}
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
