import { useTranslation } from 'react-i18next';

/** Centred empty state shown in the thread pane when no conversation is selected. */
export default function ThreadEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div
        className="flex size-12 items-center justify-center rounded-sm border border-dashed border-border text-title font-extrabold text-muted-foreground"
        aria-hidden="true"
      >
        {/* The sidebar's own brand mark (Sidebar.tsx) — not translatable copy, same as there. */}
        {'GF'}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-ink">{t('inbox.emptyState.title')}</p>
        <p className="max-w-xs text-caption text-muted-foreground">{t('inbox.emptyState.subtitle')}</p>
      </div>
    </div>
  );
}
