import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import cs from './locales/cs.json';
import en from './locales/en.json';
import de from './locales/de.json';

const savedLang = localStorage.getItem('lang') || 'cs';

i18n.use(initReactI18next).init({
  resources: {
    cs: { translation: cs },
    en: { translation: en },
    de: { translation: de },
  },
  lng: savedLang,
  fallbackLng: 'cs',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('lang', lng);
  document.documentElement.lang = lng;
  // Notify listeners (e.g. React Query cache invalidation) that language changed
  window.dispatchEvent(new CustomEvent('app:languageChanged'));
});

export default i18n;
