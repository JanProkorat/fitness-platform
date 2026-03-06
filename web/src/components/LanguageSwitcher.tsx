import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'cs', label: 'CZ' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-1">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`rounded-sm px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-wide transition-colors ${
            i18n.language === lang.code
              ? 'bg-gold/15 text-gold'
              : 'text-text3 hover:text-gold'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
