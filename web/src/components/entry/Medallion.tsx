import { useTranslation } from 'react-i18next';

/**
 * GF medallion pinned to the viewport on the seam between the scrolling
 * marketing column and the sticky login panel (spec §6 / prototype
 * `.medallion`). Hidden below the `panel` breakpoint, where the panel
 * itself unpins and the columns stack.
 */
export default function Medallion() {
  const { t } = useTranslation();

  return (
    <div
      aria-hidden="true"
      className="fixed top-1/2 z-10 hidden size-14 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface shadow-panel panel:right-panel panel:flex"
    >
      <i className="flex size-10 items-center justify-center rounded-full bg-brand text-body font-bold tracking-wide text-paper not-italic">
        {t('entry.brandMark')}
      </i>
    </div>
  );
}
