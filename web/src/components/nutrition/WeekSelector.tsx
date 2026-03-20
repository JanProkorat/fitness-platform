import { useTranslation } from 'react-i18next';

/// A single week entry displayed in the selector.
interface WeekEntry {
  /// The 1-based week number.
  weekNumber: number;
  /// The publication status of this week.
  status: 'Draft' | 'Published';
}

/// Props for the WeekSelector component.
interface WeekSelectorProps {
  /// List of weeks belonging to the plan.
  weeks: WeekEntry[];
  /// The currently selected week number.
  selectedWeek: number;
  /// Callback when the user selects a different week.
  onWeekChange: (week: number) => void;
  /// Callback to publish the currently selected week.
  onPublishWeek: () => void;
  /// Callback to add a new week to the plan.
  onAddWeek: () => void;
  /// Callback to remove the currently selected week from the plan.
  onRemoveWeek: () => void;
}

const statusBadgeClass: Record<'Draft' | 'Published', string> = {
  Draft: 'bg-yellow-500/15 text-yellow-400',
  Published: 'bg-green-500/15 text-green-400',
};

/// Horizontal week navigation bar shown inside the Meal Plan tab.
export default function WeekSelector({
  weeks,
  selectedWeek,
  onWeekChange,
  onPublishWeek,
  onAddWeek,
  onRemoveWeek,
}: WeekSelectorProps) {
  const { t } = useTranslation();

  const selected = weeks.find((w) => w.weekNumber === selectedWeek);
  const isPublished = selected?.status === 'Published';
  const canRemove = !isPublished && weeks.length > 1;

  return (
    <div className="flex items-center gap-2 border-b border-border bg-[#111111] px-6 py-2.5">
      {/* Week tabs */}
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {weeks.map(({ weekNumber, status }) => (
          <button
            key={weekNumber}
            onClick={() => onWeekChange(weekNumber)}
            className={`flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              weekNumber === selectedWeek
                ? 'bg-gold/15 text-gold'
                : 'text-text3 hover:text-text2'
            }`}
          >
            <span>{t('nutrition.weekLabel', { number: weekNumber })}</span>
            <span
              className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal ${statusBadgeClass[status]}`}
            >
              {status === 'Draft' ? t('nutrition.weekDraft') : t('nutrition.weekPublished')}
            </span>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-2">
        {selected?.status === 'Draft' && (
          <button
            onClick={onPublishWeek}
            className="rounded-sm bg-green-500/15 px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide text-green-400 transition-colors hover:bg-green-500/25"
          >
            {t('nutrition.publishWeek', { number: selectedWeek })}
          </button>
        )}

        <button
          onClick={onAddWeek}
          className="rounded-sm border border-border px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-gold"
        >
          {t('nutrition.addWeek')}
        </button>

        <button
          onClick={onRemoveWeek}
          disabled={!canRemove}
          title={
            isPublished
              ? t('nutrition.weekPublished')
              : weeks.length <= 1
                ? t('nutrition.removeWeek')
                : undefined
          }
          className="rounded-sm border border-border px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {t('nutrition.removeWeek')}
        </button>
      </div>
    </div>
  );
}
