import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'cs', label: 'CZ' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          style={{
            padding: '3px 8px',
            borderRadius: 'var(--radius)',
            fontSize: 10,
            fontWeight: 700,
            fontFamily: 'inherit',
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.1s, color 0.1s',
            background: i18n.language === lang.code ? 'var(--accent-bg)' : 'transparent',
            color: i18n.language === lang.code ? 'var(--accent)' : 'var(--text3)',
          }}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
