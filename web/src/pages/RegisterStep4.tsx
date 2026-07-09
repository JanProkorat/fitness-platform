import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

interface RegisterStep4Props {
  email: string;
}

export function RegisterStep4({ email }: RegisterStep4Props) {
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState(false);

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    setResendError(false);
    try {
      await api.post('/auth/resend-verification/anonymous', { email });
      setResendSuccess(true);
    } catch {
      setResendError(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-success">
      {/* Success icon */}
      <div className="auth-success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="auth-success-title">
        Účet byl vytvořen!
      </div>
      <div className="auth-success-text">
        Poslali jsme vám ověřovací email. Klikněte na odkaz v emailu
        pro aktivaci účtu.
      </div>

      {/* Email confirmation box */}
      <div style={{ marginTop: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg2)', padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Email odeslán na:</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{email}</div>
      </div>

      {/* Go to login */}
      <Link
        to="/login"
        className="btn-auth-primary"
        style={{ marginTop: 16, textDecoration: 'none' }}
      >
        Přejít na přihlášení
      </Link>

      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>
        Email nedorazil?{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          style={{ background: 'none', border: 'none', cursor: resending ? 'default' : 'pointer', fontWeight: 500, color: 'var(--blue)', fontSize: 13, fontFamily: 'inherit', padding: 0 }}
        >
          {resending ? t('auth.verifyEmailResending') : t('auth.verifyEmailResend')}
        </button>
      </div>

      {resendSuccess && (
        <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--green)', background: 'var(--green-bg)', fontSize: 13, color: 'var(--green)' }}>
          {t('auth.verifyEmailResent')}
        </div>
      )}

      {resendError && (
        <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
          {t('common.error')}
        </div>
      )}
    </div>
  );
}
