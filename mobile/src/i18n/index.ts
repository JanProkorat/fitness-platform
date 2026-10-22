import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import cs from './locales/cs.json';
import de from './locales/de.json';
import en from './locales/en.json';
import { SUPPORTED_LANGUAGES, isLanguage, usePreferencesStore } from '@/stores/preferences';

const SUPPORTED_LOCALES: string[] = [...SUPPORTED_LANGUAGES];
const FALLBACK_LOCALE = 'cs';

// Stored choice first, then the device language, then Czech. Loading the store here also
// applies the stored appearance before the first render.
const deviceLanguage = getLocales()[0]?.languageCode;
const lng =
  usePreferencesStore.getState().language ??
  (isLanguage(deviceLanguage) ? deviceLanguage : FALLBACK_LOCALE);

void i18n.use(initReactI18next).init({
  resources: {
    cs: { translation: cs },
    en: { translation: en },
    de: { translation: de },
  },
  lng,
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  interpolation: { escapeValue: false },
});

export default i18n;
