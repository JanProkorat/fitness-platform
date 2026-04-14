import { useTranslation } from 'react-i18next';
import { useFormContext } from 'react-hook-form';
import { cn } from '@/lib/cn';

interface RegisterStep3Props {
  error: string | null;
  loading: boolean;
  termsConsent: boolean;
  healthConsent: boolean;
  onTermsConsentChange: (value: boolean) => void;
  onHealthConsentChange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function RegisterStep3({
  error,
  loading,
  termsConsent,
  healthConsent,
  onTermsConsentChange,
  onHealthConsentChange,
  onBack,
  onSubmit,
}: RegisterStep3Props) {
  const { t } = useTranslation();
  const { handleSubmit } = useFormContext();
  const canSubmit = termsConsent && healthConsent && !loading;

  return (
    <>
      <div className="auth-title">
        Téměř <span>hotovo</span>
      </div>
      <div className="auth-sub">
        Přečtěte si podmínky a dokončete registraci.
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Checkbox: Terms */}
      <label
        className="auth-checkbox-wrap"
        style={{ marginBottom: 8 }}
        onClick={(e) => {
          e.preventDefault();
          onTermsConsentChange(!termsConsent);
        }}
      >
        <div className={cn('auth-checkbox', termsConsent && 'checked')}>
          {termsConsent && '✓'}
        </div>
        <span className="auth-checkbox-text">
          Souhlasím s{' '}
          <span style={{ fontWeight: 500, color: 'var(--accent)' }}>obchodními podmínkami</span> a{' '}
          <span style={{ fontWeight: 500, color: 'var(--accent)' }}>zásadami ochrany soukromí</span>
        </span>
      </label>

      {/* Checkbox: Health data */}
      <label
        className="auth-checkbox-wrap"
        style={{ marginBottom: 8 }}
        onClick={(e) => {
          e.preventDefault();
          onHealthConsentChange(!healthConsent);
        }}
      >
        <div className={cn('auth-checkbox', healthConsent && 'checked')}>
          {healthConsent && '✓'}
        </div>
        <span className="auth-checkbox-text">
          Souhlasím se zpracováním zdravotních dat dle GDPR čl. 9
          (tělesné míry, výkonnostní záznamy, fotky pokroku)
        </span>
      </label>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onBack}
          className="btn"
          style={{ padding: '10px 16px', fontSize: 14 }}
        >
          ← Zpět
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(onSubmit)()}
          disabled={!canSubmit}
          className="btn-auth-primary"
          style={{ flex: 1 }}
        >
          {loading ? 'Vytvářím účet…' : 'Vytvořit účet'}
        </button>
      </div>
    </>
  );
}
