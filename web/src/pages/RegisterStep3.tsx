import { useFormContext, type SubmitHandler, type FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface RegisterStep3Props {
  error: string | null;
  loading: boolean;
  termsConsent: boolean;
  healthConsent: boolean;
  requireHealthConsent: boolean;
  onTermsConsentChange: (value: boolean) => void;
  onHealthConsentChange: (value: boolean) => void;
  onBack: () => void;
  onSubmit: SubmitHandler<FieldValues>;
}

export function RegisterStep3({
  error,
  loading,
  termsConsent,
  healthConsent,
  requireHealthConsent,
  onTermsConsentChange,
  onHealthConsentChange,
  onBack,
  onSubmit,
}: RegisterStep3Props) {
  const { handleSubmit } = useFormContext();
  const { t } = useTranslation();
  const canSubmit = termsConsent && (!requireHealthConsent || healthConsent) && !loading;

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

      {/* Checkbox: Classic GDPR personal-data consent (all roles) */}
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
          {t('auth.register.gdprConsent')}
        </span>
      </label>

      {/* Checkbox: Art. 9 health-data consent (client invite path only) */}
      {requireHealthConsent && (
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
            {t('auth.register.healthDataConsent')}
          </span>
        </label>
      )}

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
          {loading ? t('auth.register.registerLoading') : t('auth.register.registerSubmit')}
        </button>
      </div>
    </>
  );
}
