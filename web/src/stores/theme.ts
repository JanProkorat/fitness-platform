import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

/** localStorage key of the explicit choice; duplicated in the inline script in index.html. */
export const THEME_STORAGE_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeState {
  /** The theme currently in effect: the stored choice, else the OS preference. */
  theme: Theme;
  /** What the user picked; `system` means no explicit choice is stored. */
  preference: ThemePreference;
  toggleTheme: () => void;
  setPreference: (preference: ThemePreference) => void;
}

function readExplicitTheme(): Theme | null {
  const value = document.documentElement.dataset['theme'];
  return value === 'light' || value === 'dark' ? value : null;
}

function osTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function applyExplicit(next: Theme): void {
  document.documentElement.dataset['theme'] = next;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
}

function clearExplicit(): void {
  delete document.documentElement.dataset['theme'];
  try {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing persisted to clear.
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  // The inline script in index.html already set data-theme from storage before first paint.
  theme: readExplicitTheme() ?? osTheme(),
  preference: readExplicitTheme() ?? 'system',
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    applyExplicit(next);
    set({ theme: next, preference: next });
  },
  setPreference: (preference) => {
    if (preference === 'system') {
      clearExplicit();
      set({ theme: osTheme(), preference });
      return;
    }
    applyExplicit(preference);
    set({ theme: preference, preference });
  },
}));

// While the user has made no explicit choice, follow live OS changes.
window.matchMedia(DARK_QUERY).addEventListener('change', () => {
  if (readExplicitTheme() === null) {
    useThemeStore.setState({ theme: osTheme() });
  }
});
