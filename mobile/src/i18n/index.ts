import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import cs from './locales/cs.json';
import de from './locales/de.json';
import en from './locales/en.json';

const SUPPORTED_LOCALES = ['cs', 'en', 'de'];
const FALLBACK_LOCALE = 'cs';

const deviceLanguage = getLocales()[0]?.languageCode ?? FALLBACK_LOCALE;
const lng = SUPPORTED_LOCALES.includes(deviceLanguage) ? deviceLanguage : FALLBACK_LOCALE;

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
