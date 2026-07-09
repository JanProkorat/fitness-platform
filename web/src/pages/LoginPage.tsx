import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { apiClient } from '@/api/client';
import { showError, showApiError } from '@/lib/api-errors';
import type { LoginResponse } from '@/api/client';
import { INVITE_TOKEN_KEY } from '@/pages/InviteAcceptPage';
import { googleSocialLogin, appleSocialLogin, requestSocialNonce } from '@/api/auth';
import { signInWithApple } from '@/lib/appleAuth';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const setTokens = useAuthStore((s) => s.setTokens);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'accepted' | 'failed' | null>(null);
  /**
   * Single-use nonce for the Google sign-in flow. Fetched on mount so it
   * exists before the user clicks the Google button (the nonce must be
   * present when GoogleLogin calls google.accounts.id.initialize).
   * Refreshed after each attempt (success or failure) so a retry works.
   * null means the nonce is still loading — the Google button is disabled
   * until a nonce is available.
   */
  const [googleNonce, setGoogleNonce] = useState<string | null>(null);

  const fetchGoogleNonce = useCallback(async () => {
    try {
      const nonce = await requestSocialNonce();
      setGoogleNonce(nonce);
    } catch {
      // Non-fatal on load — showApiError would be noise before the user has
      // even tried to sign in. The button stays disabled until the next
      // refresh attempt (triggered after a sign-in error). If the error
      // persists the user will see auth.loginError when they try to use it.
      setGoogleNonce(null);
    }
  }, []);

  useEffect(() => {
    void fetchGoogleNonce();
  }, [fetchGoogleNonce]);

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

  /**
   * Shared post-authentication flow, run identically after any successful
   * login — email/password, Google, or Apple. Each provider-specific caller
   * is responsible only for obtaining the `LoginResponse`; this helper owns
   * everything that happens once tokens exist:
   *
   *   session set → fetch profile → store login → redirect to email
   *   verification if unconfirmed → consume a pending invite token (if any)
   *   → navigate to the final destination.
   *
   * Invite consumption (410/expired or success) always resolves before
   * navigating — a stale or invalid invite must never block login, so both
   * branches fall through to the same final `navigate` call. Provider auth
   * errors (401 social-login rejection) are intentionally NOT handled here;
   * they stay in the caller's own try/catch so `showApiError` and
   * provider-specific loading/nonce cleanup are not swallowed by this helper.
   */
  const completeLogin = useCallback(
    async (res: LoginResponse) => {
      setTokens(res.accessToken!, res.refreshToken!);
      const profile = await apiClient.getProfileEndpoint();
      const emailConfirmed = res.emailConfirmed ?? true;

      login(
        {
          publicId: profile.userId!,
          email: profile.email!,
          firstName: profile.firstName!,
          lastName: profile.lastName!,
          roles: profile.roles ?? [],
          emailConfirmed,
          avatarBlobUrl: profile.avatarBlobUrl ?? null,
        },
        res.accessToken!,
        res.refreshToken!,
      );

      // Redirect to email verification if not confirmed
      if (!emailConfirmed) {
        navigate('/verify-email', { replace: true });
        return;
      }

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
    },
    [navigate, login, setTokens],
  );

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const res: LoginResponse = await apiClient.loginEndpoint(data);
      await completeLogin(res);
    } catch {
      showError('auth.loginError');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Called by the invisible <GoogleLogin> component after the Google credential
   * dialog completes. credentialResponse.credential is the ID token JWT that the
   * backend verifies via GoogleJsonWebSignature.ValidateAsync — not an OAuth
   * access token.
   *
   * The nonce passed to <GoogleLogin> is embedded by GIS into the id_token's
   * nonce claim as the raw value; the backend compares it directly (Google does
   * not hash it, unlike Apple). After each attempt we clear and re-fetch the
   * nonce so a retry works — the old nonce is consumed (or expired on failure)
   * and cannot be reused.
   */
  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential || !googleNonce) return;
    setGoogleLoading(true);
    // Capture the current nonce and immediately clear it so the button becomes
    // disabled during the in-flight request; we re-fetch in finally.
    const nonce = googleNonce;
    setGoogleNonce(null);
    try {
      const res: LoginResponse = await googleSocialLogin(credentialResponse.credential, nonce);
      // Google has verified the email, so emailConfirmed is always true for
      // new accounts. completeLogin still checks in case an existing linked
      // account was somehow unverified.
      await completeLogin(res);
    } catch (err) {
      showApiError(err, 'auth.loginError');
    } finally {
      setGoogleLoading(false);
      // Re-fetch a fresh nonce regardless of outcome — the used nonce is
      // consumed (success) or should not be retried (failure).
      void fetchGoogleNonce();
    }
  };

  /**
   * Triggered by the Apple button click. Loads the Apple JS SDK on demand,
   * opens the Apple popup, and completes sign-in via POST /auth/social/apple.
   *
   * firstName/lastName are present only on the first Apple authorization —
   * Apple omits them on subsequent sign-ins. The backend persists them on
   * new account provision only and ignores them on returning users.
   *
   * The nonce flow: we first request a single-use nonce from the backend, then
   * pass it to signInWithApple so the Apple JS SDK embeds SHA-256(nonce) into
   * the id_token. We then send the RAW nonce back in the login body; the
   * backend hashes it and compares against the token claim.
   */
  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    try {
      const nonce = await requestSocialNonce();
      const { identityToken, authorizationCode, firstName, lastName } = await signInWithApple({ nonce });
      const res: LoginResponse = await appleSocialLogin({
        identityToken,
        authorizationCode,
        firstName,
        lastName,
        nonce,
      });
      // Apple has verified the email (or it is a private-relay address, which
      // is also considered confirmed). completeLogin still checks in case an
      // existing linked account was somehow unverified.
      await completeLogin(res);
    } catch (err) {
      showApiError(err, 'auth.loginError');
    } finally {
      setAppleLoading(false);
    }
  };

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
            <div className="auth-logo-sub">{t('auth.tagline')}</div>
          </div>
        </div>

        {/* Title */}
        <div className="auth-title">
          {t('auth.loginHeroTitle')} <span>{t('auth.loginHeroTitleHighlight')}</span>
        </div>
        <div className="auth-sub">{t('auth.loginHeroSubtitle')}</div>

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
            <label className="form-label">{t('common.email')}</label>
            <input
              type="email"
              {...register('email')}
              className="auth-input"
              placeholder={t('auth.emailPlaceholder')}
              autoComplete="email"
            />
            {errors.email && (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('auth.password')}</span>
              <Link
                to="/forgot-password"
                style={{ fontWeight: 500, color: 'var(--accent)', fontSize: 12, textDecoration: 'none' }}
              >
                {t('auth.forgotPasswordLink')}
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
            {loading ? t('auth.loginLoading') : t('auth.login')}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">{t('auth.orDivider')}</div>

        {/* Social Buttons */}
        {/*
          The custom-styled button is the visible surface; the <GoogleLogin>
          component sits invisibly on top (opacity 0, pointer-events: all) so
          Google's credential dialog fires when the user clicks the button area.
          The onSuccess callback receives credentialResponse.credential — the
          ID token JWT — which is what POST /auth/social/google expects.

          The nonce prop is passed to GoogleLogin so GIS embeds it in the
          id_token via google.accounts.id.initialize. The overlay is disabled
          until googleNonce is available (non-null) so a click before the nonce
          is fetched does not produce a credential without a nonce.
        */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="auth-social"
            disabled={googleLoading || googleNonce === null}
            style={{ width: '100%' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? t('auth.googleLoading') : t('auth.continueWithGoogle')}
          </button>
          {/* Invisible GoogleLogin overlay — renders a 0-opacity button that
              fills the same space. When clicked it opens Google's credential
              popup and calls onSuccess with the ID token credential.
              Disabled until googleNonce is loaded (null = loading/unavailable). */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              overflow: 'hidden',
              pointerEvents: googleLoading || googleNonce === null ? 'none' : 'all',
            }}
            aria-hidden="true"
          >
            {googleNonce !== null && (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => {
                  showError('auth.loginError');
                  void fetchGoogleNonce();
                }}
                width="100%"
                useOneTap={false}
                nonce={googleNonce}
              />
            )}
          </div>
        </div>

        <button
          type="button"
          className="auth-social"
          disabled={appleLoading}
          onClick={handleAppleSignIn}
          style={{ width: '100%' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          {appleLoading ? t('auth.appleLoading') : t('auth.continueWithApple')}
        </button>

        {/* Footer */}
        <div className="auth-footer">
          {t('auth.noAccount')}{' '}
          <Link
            to="/register"
            state={{ fromInvite: hasPendingInvite || fromInvite }}
          >
            {t('auth.registerLink')}
          </Link>
        </div>
      </div>
    </div>
  );
}
