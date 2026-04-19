import { useTranslation } from 'react-i18next';
import type { CheckInFlag } from '@/api/weekly-checkins';

/** Emoji icon per flag — defined here to avoid magic strings scattered across the codebase. */
const FLAG_ICONS: Record<CheckInFlag, string> = {
  Traveling: '✈️',
  EventOrCelebration: '🎉',
  SickOrLowEnergy: '🤒',
  InjuryOrPain: '🩹',
  MoreTimeAvailable: '⏱️',
  LessTimeAvailable: '⏳',
};

interface CheckInFlagChipsProps {
  flags: CheckInFlag[];
  /** When true renders a muted, compact chip row (for pending / no-response states). */
  muted?: boolean;
}

/**
 * Renders a horizontal row of flag chips for a weekly check-in response.
 * Returns null when the flag list is empty.
 */
export function CheckInFlagChips({ flags, muted = false }: CheckInFlagChipsProps) {
  const { t } = useTranslation();

  if (flags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <span
          key={flag}
          className={
            muted
              ? 'inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-medium bg-bg3 text-text3'
              : 'inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[11px] font-medium bg-accent-bg text-accent border border-accent-br'
          }
        >
          <span>{FLAG_ICONS[flag]}</span>
          {t(`weeklyCheckIn.flag.${flag.charAt(0).toLowerCase() + flag.slice(1)}`)}
        </span>
      ))}
    </div>
  );
}
