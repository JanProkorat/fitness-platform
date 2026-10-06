import { AppleIcon, PlayIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const ICON_BUTTON_CLASS =
  'flex h-10 w-11 items-center justify-center rounded-field border border-border bg-surface text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

const WIDE_BUTTON_CLASS =
  'flex h-14 flex-1 items-center justify-center gap-2.5 rounded-xl bg-primary text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** A store link is only trusted when it is an absolute http(s) URL. */
function storeUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

interface StoreButtonsProps {
  className?: string;
  /** `icon` = compact icon buttons; `wide` = labelled buttons that share the row width. */
  variant?: 'icon' | 'wide';
}

/**
 * App Store and Google Play buttons. Each links out when its
 * VITE_APP_STORE_URL / VITE_GOOGLE_PLAY_URL is set and renders disabled
 * ("coming soon") otherwise, so the app can ship before the listings exist.
 */
export default function StoreButtons({ className, variant = 'icon' }: StoreButtonsProps) {
  const { t } = useTranslation();
  const wide = variant === 'wide';

  const stores: { id: 'appStore' | 'googlePlay'; Icon: LucideIcon; url: string | null }[] = [
    { id: 'appStore', Icon: AppleIcon, url: storeUrl(import.meta.env.VITE_APP_STORE_URL) },
    { id: 'googlePlay', Icon: PlayIcon, url: storeUrl(import.meta.env.VITE_GOOGLE_PLAY_URL) },
  ];

  return (
    <div className={cn('flex gap-2', wide && 'flex-col gap-2.5 sm:flex-row', className)}>
      {stores.map(({ id, Icon, url }) => {
        const name = t(`entry.register.stores.${id}`);
        const content = wide ? (
          <>
            <Icon className="size-5.5" aria-hidden="true" />
            <span className="flex flex-col items-start leading-tight">
              <span className="text-caption font-medium">
                {t(`entry.verifyEmail.getApp.${id === 'appStore' ? 'downloadOn' : 'getItOn'}`)}
              </span>
              <span className="text-subhead font-bold">{name}</span>
            </span>
          </>
        ) : (
          <Icon className="size-4" aria-hidden="true" />
        );

        if (url) {
          return (
            <a
              key={id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className={cn(wide ? WIDE_BUTTON_CLASS : ICON_BUTTON_CLASS, wide ? 'hover:opacity-90' : 'hover:bg-sunken')}
            >
              {content}
            </a>
          );
        }
        return (
          <button
            key={id}
            type="button"
            disabled
            aria-label={`${name} — ${t('entry.register.stores.comingSoon')}`}
            title={t('entry.register.stores.comingSoon')}
            className={cn(wide ? WIDE_BUTTON_CLASS : ICON_BUTTON_CLASS, 'cursor-not-allowed opacity-50')}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
