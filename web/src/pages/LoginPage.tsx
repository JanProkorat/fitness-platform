import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { apiClient } from '@/api/client';
import { showError } from '@/lib/api-errors';
import type { LoginResponse } from '@/api/client';
import { INVITE_TOKEN_KEY } from '@/pages/InviteAcceptPage';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const setTokens = useAuthStore((s) => s.setTokens);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'accepted' | 'failed' | null>(null);
  const justRegistered = (location.state as { registered?: boolean })?.registered;
  const fromInvite = (location.state as { fromInvite?: boolean })?.fromInvite;
  const hasPendingInvite = !!localStorage.getItem(INVITE_TOKEN_KEY);

  const loginSchema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
    password: z.string().min(1, t('validation.required')),
  });

  type LoginForm = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res: LoginResponse = await apiClient.loginEndpoint(data);
      setTokens(res.accessToken!, res.refreshToken!);
      const profile = await apiClient.getProfileEndpoint();
      login(
        {
          publicId: profile.userId!,
          email: profile.email!,
          firstName: profile.firstName!,
          lastName: profile.lastName!,
          roles: profile.roles ?? [],
        },
        res.accessToken!,
        res.refreshToken!,
      );

      const roles = profile.roles ?? [];
      const isClientOnly = roles.includes('Client') && !roles.some((r: string) => ['Trainer', 'Nutritionist', 'Admin'].includes(r));

      const pendingToken = localStorage.getItem(INVITE_TOKEN_KEY);
      if (pendingToken) {
        try {
          await apiClient.acceptInvitationEndpoint({ token: pendingToken });
          localStorage.removeItem(INVITE_TOKEN_KEY);
          setInviteStatus('accepted');
          await new Promise((r) => setTimeout(r, 2000));
        } catch {
          localStorage.removeItem(INVITE_TOKEN_KEY);
          setInviteStatus('failed');
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      navigate(isClientOnly ? '/download-app' : '/dashboard', { replace: true });
    } catch {
      showError('auth.loginError');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
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

        {/* Title */}
        <div className="auth-title">
          Vítejte <span>zpět</span>
        </div>
        <div className="auth-sub">Přihlaste se ke svému účtu</div>

        {/* Status banners */}
        {justRegistered && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--green)', background: 'var(--green-bg)', fontSize: 13, color: 'var(--green)' }}>
            {t('auth.registeredSuccess')}
          </div>
        )}

        {(fromInvite || hasPendingInvite) && !justRegistered && !inviteStatus && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-br)', background: 'var(--accent-bg)', fontSize: 13, color: 'var(--accent)' }}>
            {t('auth.inviteRegisterHint')}
          </div>
        )}

        {inviteStatus === 'accepted' && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--green)', background: 'var(--green-bg)', fontSize: 13, color: 'var(--green)' }}>
            {t('auth.inviteAccepted')}
          </div>
        )}

        {inviteStatus === 'failed' && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
            {t('auth.inviteExpired')}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Email */}
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

          {/* Password */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Heslo</span>
              <Link
                to="/forgot-password"
                style={{ fontWeight: 500, color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}
              >
                Zapomenuté heslo?
              </Link>
            </label>
            <div className="auth-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className="auth-input"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-auth-primary"
            style={{ marginTop: 4 }}
          >
            {loading ? t('auth.loginLoading') : 'Přihlásit se'}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">nebo</div>

        {/* Social Buttons */}
        <button type="button" className="auth-social">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Pokračovat přes Google
        </button>

        <button type="button" className="auth-social">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Pokračovat přes Apple
        </button>

        {/* Footer */}
        <div className="auth-footer">
          Nemáte účet?{' '}
          <Link
            to="/register"
            state={{ fromInvite: hasPendingInvite || fromInvite }}
          >
            Zaregistrujte se
          </Link>
        </div>
      </div>
    </div>
  );
}
