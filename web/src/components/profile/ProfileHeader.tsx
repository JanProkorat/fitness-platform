import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Eyebrow, title and subtitle, with the save controls (if any) on the right. */
export default function ProfileHeader({ actions }: { actions?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.75 text-label font-semibold tracking-label text-marker uppercase">
          <span className="size-1.75 rounded-full bg-marker" aria-hidden="true" />
          {t('profile.page.eyebrow')}
        </span>
        <h1 className="text-title font-bold text-ink">{t('profile.page.title')}</h1>
        <p className="text-body text-muted-foreground">{t('profile.page.subtitle')}</p>
      </div>
      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </div>
  );
}
