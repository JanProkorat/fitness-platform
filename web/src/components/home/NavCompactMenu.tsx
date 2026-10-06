import { GlobeIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useThemeStore } from '@/stores/theme';

const LANGUAGES = ['cs', 'en', 'de'] as const;
type Language = (typeof LANGUAGES)[number];

function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** Phone-width replacement for the language switch and theme toggle: one trigger, one menu. */
export default function NavCompactMenu() {
  const { t, i18n } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const current = isLanguage(i18n.language) ? i18n.language : 'cs';
  const toDark = theme === 'light';
  const ThemeIcon = toDark ? MoonIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('home.nav.menuLabel')}
          className="flex h-10 items-center gap-1.5 rounded-field border border-border bg-surface px-2.5 text-caption font-semibold tracking-caps text-ink hover:bg-sunken"
        >
          <GlobeIcon className="size-4" aria-hidden="true" />
          {t(`entry.languageSwitch.${current}`)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('entry.languageSwitch.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (isLanguage(value)) {
              void i18n.changeLanguage(value);
            }
          }}
        >
          {LANGUAGES.map((lng) => (
            <DropdownMenuRadioItem key={lng} value={lng}>
              {t(`entry.languageSwitch.${lng}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleTheme}>
          <ThemeIcon aria-hidden="true" />
          {t(toDark ? 'home.nav.themeToDark' : 'home.nav.themeToLight')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
