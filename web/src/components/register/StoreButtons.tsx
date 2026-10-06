import { AppleIcon, PlayIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const BUTTON_CLASS =
  'flex h-10 w-11 items-center justify-center rounded-field border border-border bg-surface text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** A store link is only trusted when it is an absolute http(s) URL. */
function storeUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * App Store and Google Play buttons. Each links out when its
 * VITE_APP_STORE_URL / VITE_GOOGLE_PLAY_URL is set and renders disabled
 * ("coming soon") otherwise, so the app can ship before the listings exist.
 */
export default function StoreButtons({ className }: { className?: string }) {
  const { t } = useTranslation();

  const stores: { id: 'appStore' | 'googlePlay'; Icon: LucideIcon; url: string | null }[] = [
    { id: 'appStore', Icon: AppleIcon, url: storeUrl(import.meta.env.VITE_APP_STORE_URL) },
    { id: 'googlePlay', Icon: PlayIcon, url: storeUrl(import.meta.env.VITE_GOOGLE_PLAY_URL) },
  ];

  return (
    <div className={cn('flex gap-2', className)}>
      {stores.map(({ id, Icon, url }) => {
        const name = t(`entry.register.stores.${id}`);
        if (url) {
          return (
            <a
              key={id}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              className={cn(BUTTON_CLASS, 'hover:bg-sunken')}
            >
              <Icon className="size-4" aria-hidden="true" />
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
            className={cn(BUTTON_CLASS, 'cursor-not-allowed opacity-50')}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
