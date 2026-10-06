import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/stores/theme';

/** Light/dark switch for the landing nav. The label names the action, not the current state. */
export default function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const toDark = theme === 'light';
  const Icon = toDark ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      aria-label={t(toDark ? 'home.nav.themeToDark' : 'home.nav.themeToLight')}
      onClick={toggleTheme}
      className="flex size-10 shrink-0 items-center justify-center rounded-field border border-border bg-surface text-ink hover:bg-sunken"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
