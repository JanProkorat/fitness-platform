import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const LANGUAGES = ['cs', 'en', 'de'] as const;

/**
 * CS/EN/DE language switch for the login panel (spec §6 / prototype
 * `.langswitch`). Calling `i18n.changeLanguage` is the entire mechanism —
 * `src/i18n/index.ts`'s `languageChanged` listener already persists the
 * choice under the `lang` localStorage key (read by Playwright's auth
 * setup), sets `<html lang>`, and dispatches the app-wide change event.
 */
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <div role="group" aria-label={t('entry.languageSwitch.label')} className="flex gap-1">
      {LANGUAGES.map((lng) => {
        const active = i18n.language === lng;
        return (
          <button
            key={lng}
            type="button"
            aria-pressed={active}
            onClick={() => {
              void i18n.changeLanguage(lng);
            }}
            className={cn(
              'rounded-sm border border-border px-2.25 py-1 text-caption font-semibold tracking-[.04em] text-muted-foreground',
              active && 'border-pill bg-pill text-paper'
            )}
          >
            {t(`entry.languageSwitch.${lng}`)}
          </button>
        );
      })}
    </div>
  );
}
