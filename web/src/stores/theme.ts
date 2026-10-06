import { create } from 'zustand';

export type Theme = 'light' | 'dark';

/** localStorage key of the explicit choice; duplicated in the inline script in index.html. */
export const THEME_STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeState {
  /** The theme currently in effect: the stored choice, else the OS preference. */
  theme: Theme;
  toggleTheme: () => void;
}

function readExplicitTheme(): Theme | null {
  const value = document.documentElement.dataset['theme'];
  return value === 'light' || value === 'dark' ? value : null;
}

function osTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // The inline script in index.html already set data-theme from storage before first paint.
  theme: readExplicitTheme() ?? osTheme(),
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice still applies for this session.
    }
    set({ theme: next });
  },
}));

// While the user has made no explicit choice, follow live OS changes.
window.matchMedia(DARK_QUERY).addEventListener('change', () => {
  if (readExplicitTheme() === null) {
    useThemeStore.setState({ theme: osTheme() });
  }
});
