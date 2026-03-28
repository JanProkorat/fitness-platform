import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { apiClient } from '@/api/client';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'sent'>('form');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [resending, setResending] = useState(false);

  const schema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
  });

  type ForgotForm = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.requestPasswordResetEndpoint({ email: data.email });
      setSentEmail(data.email);
      setStep('sent');
    } catch {
      setError(t('auth.forgotPasswordError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiClient.requestPasswordResetEndpoint({ email: sentEmail || getValues('email') });
    } catch {
      // silently fail on resend
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
        <DarkModeToggle />
        <LanguageSwitcher />
      </div>

      <div className="auth-card">
        {step === 'form' ? (
          <>
            <button type="button" className="auth-back" onClick={() => navigate('/login')}>
              ← Zpět na přihlášení
            </button>

            <div className="auth-title">
              Zapomenuté <span>heslo</span>
            </div>
            <div className="auth-sub">
              Zadejte svůj email a pošleme vám odkaz pro reset hesla.
            </div>

            {error && (
              <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="auth-input"
                  placeholder="vas@email.cz"
                  autoComplete="email"
                />
                {errors.email && (
                  <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.email.message}</p>
                )}
              </div>

              <button type="submit" disabled={loading} className="btn-auth-primary" style={{ marginBottom: 12 }}>
                {loading ? 'Odesílání...' : 'Odeslat odkaz pro reset'}
              </button>
            </form>

            <div className="auth-footer">
              Vzpomněli jste si?{' '}
              <Link to="/login">Přihlaste se</Link>
            </div>
          </>
        ) : (
          <>
            <button type="button" className="auth-back" onClick={() => navigate('/login')}>
              ← Zpět na přihlášení
            </button>

            <div className="auth-success">
              <div className="auth-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div className="auth-success-title">Email odeslán</div>
              <div className="auth-success-text">
                Poslali jsme vám instrukce pro reset hesla. Zkontrolujte svou schránku — email by měl dorazit do pár minut.
              </div>
            </div>

            <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--text2)', textAlign: 'left' as const }}>
              <span style={{ color: 'var(--text3)', fontSize: 11, display: 'block', marginBottom: 3 }}>Odkaz odeslán na:</span>
              <span style={{ fontWeight: 500, color: 'var(--text)' }}>{sentEmail}</span>
            </div>

            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)', textAlign: 'center' as const }}>
              Email nedorazil?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                style={{ color: 'var(--blue)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }}
              >
                {resending ? 'Odesílání...' : 'Odeslat znovu'}
              </button>
            </div>

            <button type="button" className="btn-auth-primary" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
              Zpět na přihlášení
            </button>
          </>
        )}
      </div>
    </div>
  );
}
