import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import api from '@/lib/api';

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const [verifying, setVerifying] = useState(!!token);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [remainingResends, setRemainingResends] = useState<number | null>(null);

  // If token in URL, verify it automatically
  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setVerified(true);
        if (user) {
          setUser({ ...user, emailConfirmed: true });
        }
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
      } catch (err: unknown) {
        const resp = (err as { response?: { data?: { errors?: { errorCode?: string }[] } } })?.response?.data;
        const errorCode = resp?.errors?.[0]?.errorCode;
        if (errorCode === 'VERIFICATION_TOKEN_EXPIRED') {
          setError(t('auth.verifyEmailExpired'));
        } else {
          setError(t('auth.verifyEmailInvalid'));
        }
      } finally {
        setVerifying(false);
      }
    })();
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    setError(null);
    try {
      const { data: res } = await api.post('/auth/resend-verification');
      setResendSuccess(true);
      setRemainingResends(res.remainingResends ?? null);
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: { errors?: { errorCode?: string }[] } } })?.response?.data;
      const errorCode = resp?.errors?.[0]?.errorCode;
      if (errorCode === 'VERIFICATION_RESEND_LIMIT_REACHED') {
        setRemainingResends(0);
      } else {
        setError(t('auth.verifyEmailInvalid'));
      }
    } finally {
      setResending(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // If already verified, redirect
  if (user?.emailConfirmed && !token) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <div className="auth-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
        <DarkModeToggle />
        <LanguageSwitcher />
      </div>

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">GF</div>
          <div>
            <div className="auth-logo-name">GoodFellas Platform</div>
            <div className="auth-logo-sub">Fitness &amp; výživa</div>
          </div>
        </div>

        {verifying ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="auth-title">{t('auth.verifyEmailTitle')}</div>
            <div className="auth-sub" style={{ marginTop: 8 }}>
              {t('auth.verifyEmailResending')}
            </div>
          </div>
        ) : verified ? (
          <>
            <div className="auth-success">
              <div className="auth-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="auth-success-title">{t('auth.verifyEmailSuccess')}</div>
            </div>
          </>
        ) : (
          <>
            <div className="auth-success">
              <div className="auth-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <div className="auth-success-title">{t('auth.verifyEmailTitle')}</div>
              <div className="auth-success-text">
                {t('auth.verifyEmailSubtitle')}
              </div>
            </div>

            {user?.email && (
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text2)', textAlign: 'left' }}>
                <span style={{ color: 'var(--text3)', fontSize: 11, display: 'block', marginBottom: 3 }}>Email:</span>
                <span style={{ fontWeight: 500, color: 'var(--text)' }}>{user.email}</span>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
                {error}
              </div>
            )}

            {resendSuccess && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--green)', background: 'var(--green-bg)', fontSize: 13, color: 'var(--green)' }}>
                {t('auth.verifyEmailResent')}
              </div>
            )}

            <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
              {t('auth.verifyEmailCheckSpam')}
            </div>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {remainingResends === 0 ? (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--orange)', background: 'var(--orange-bg)', fontSize: 13, color: 'var(--orange)', textAlign: 'center' }}>
                  {t('auth.verifyEmailResendLimit')}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-auth-primary"
                    onClick={handleResend}
                    disabled={resending}
                  >
                    {resending ? t('auth.verifyEmailResending') : t('auth.verifyEmailResend')}
                  </button>
                  {remainingResends !== null && remainingResends > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                      {t('auth.verifyEmailResendRemaining', { count: remainingResends })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleLogout}
                style={{ color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 13, padding: 0, textDecoration: 'underline' }}
              >
                {t('auth.logout')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
