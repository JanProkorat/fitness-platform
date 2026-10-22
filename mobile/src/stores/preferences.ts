import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import { create } from 'zustand';

export const SUPPORTED_LANGUAGES = ['cs', 'en', 'de'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const APPEARANCES = ['system', 'light', 'dark'] as const;
export type AppearancePreference = (typeof APPEARANCES)[number];

const LANGUAGE_KEY = 'preferences.language';
const APPEARANCE_KEY = 'preferences.appearance';

export const isLanguage = (value: unknown): value is Language =>
  SUPPORTED_LANGUAGES.some((language) => language === value);

const isAppearance = (value: unknown): value is AppearancePreference =>
  APPEARANCES.some((appearance) => appearance === value);

/** Synchronous read, so the stored choice is known before the first render. */
function readStored(key: string): string | null {
  try {
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    SecureStore.setItem(key, value);
  } catch {
    // The choice still applies for this session; it just will not survive a restart.
  }
}

/** Forces the OS colour scheme for this app, or hands it back to the system. */
function applyAppearance(appearance: AppearancePreference): void {
  Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
}

type PreferencesState = {
  appearance: AppearancePreference;
  /** The language the user picked on this device, or null while the device language applies. */
  language: Language | null;
  setAppearance: (appearance: AppearancePreference) => void;
  setLanguage: (language: Language) => void;
};

const storedAppearance = readStored(APPEARANCE_KEY);
const storedLanguage = readStored(LANGUAGE_KEY);
const initialAppearance: AppearancePreference = isAppearance(storedAppearance)
  ? storedAppearance
  : 'system';

/** Device-level choices. They are not tied to the account, so they survive logout. */
export const usePreferencesStore = create<PreferencesState>((set) => ({
  appearance: initialAppearance,
  language: isLanguage(storedLanguage) ? storedLanguage : null,
  setAppearance: (appearance) => {
    applyAppearance(appearance);
    writeStored(APPEARANCE_KEY, appearance);
    set({ appearance });
  },
  setLanguage: (language) => {
    writeStored(LANGUAGE_KEY, language);
    set({ language });
  },
}));

if (initialAppearance !== 'system') {
  applyAppearance(initialAppearance);
}
