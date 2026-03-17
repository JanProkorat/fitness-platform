import { useTranslation } from 'react-i18next';

interface PlanToolbarProps {
  planName: string;
  status: string;
  isDirty: boolean;
  isSaving: boolean;
  selectedWeek: number;
  totalWeeks: number;
  onPublish: () => void;
  onWeekChange: (week: number) => void;
}

const statusStyles: Record<string, string> = {
  Draft: 'bg-yellow-500/15 text-yellow-400',
  Active: 'bg-green-500/15 text-green-400',
  Archived: 'bg-white/5 text-text3',
};

export default function PlanToolbar({
  planName,
  status,
  isDirty,
  isSaving,
  selectedWeek,
  totalWeeks,
  onPublish,
  onWeekChange,
}: PlanToolbarProps) {
  const { t } = useTranslation();

  const statusLabel =
    status === 'Draft'
      ? t('nutrition.statusDraft')
      : status === 'Active'
        ? t('nutrition.statusActive')
        : t('nutrition.statusArchived');

  return (
    <div className="flex items-center gap-4 border-b border-border bg-[#111111] px-6 py-3">
      {/* Plan name + status */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold">{planName}</h1>
        <span
          className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold ${statusStyles[status] ?? statusStyles.Archived}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Week selector */}
      {totalWeeks > 1 && (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              onClick={() => onWeekChange(w)}
              className={`rounded-sm px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                w === selectedWeek
                  ? 'bg-gold/15 text-gold'
                  : 'text-text3 hover:text-gold'
              }`}
            >
              {t('nutrition.weekLabel', { number: w })}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Save status */}
      <div className="flex items-center gap-3">
        {isSaving ? (
          <span className="text-xs text-text3">{t('nutrition.saving')}</span>
        ) : isDirty ? (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            {t('nutrition.unsavedChanges')}
          </span>
        ) : (
          <span className="text-xs text-text3">{t('nutrition.allSaved')}</span>
        )}

        {/* Publish button */}
        {status === 'Draft' && (
          <button
            onClick={onPublish}
            className="rounded-sm bg-gold px-4 py-2 font-heading text-[13px] font-extrabold uppercase tracking-wide text-black transition-colors hover:bg-gold-bright"
          >
            {t('nutrition.publish')}
          </button>
        )}
      </div>
    </div>
  );
}
