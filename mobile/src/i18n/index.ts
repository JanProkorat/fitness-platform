import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import cs from './locales/cs.json';
import de from './locales/de.json';

const SUPPORTED = ['en', 'cs', 'de'];
const deviceLang = getLocales()[0]?.languageCode ?? 'en';
const lng = SUPPORTED.includes(deviceLang) ? deviceLang : 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, cs: { translation: cs }, de: { translation: de } },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
