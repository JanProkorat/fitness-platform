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
      // Store tokens first, then fetch profile for user info
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

      // Auto-accept pending invitation after login
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
    <div
      className="relative flex min-h-screen items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(ellipse at 50% 30%, rgba(201,168,76,0.05), transparent 60%)',
      }}
    >
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <span className="font-heading text-2xl font-black uppercase tracking-[3px] text-gold">
            GF
          </span>
          <span className="font-heading text-2xl font-normal uppercase tracking-wide text-text2">
            {' '}
            Platform
          </span>
        </div>

        {/* Card */}
        <div className="rounded-sm border border-border bg-surface p-8">
          <h1 className="mb-1 text-2xl font-bold">{t('auth.login')}</h1>
          <p className="mb-8 text-sm text-muted">
            {t('auth.loginSubtitle')}
          </p>

          {justRegistered && (
            <div className="mb-4 rounded-sm border border-green-bright/30 bg-green-bright/8 px-4 py-3 text-sm text-green-bright">
              {t('auth.registeredSuccess')}
            </div>
          )}

          {(fromInvite || hasPendingInvite) && !justRegistered && !inviteStatus && (
            <div className="mb-4 rounded-sm border border-gold-dim/30 bg-gold/8 px-4 py-3 text-sm text-gold">
              {t('auth.inviteRegisterHint')}
            </div>
          )}

          {inviteStatus === 'accepted' && (
            <div className="mb-4 rounded-sm border border-green-bright/30 bg-green-bright/8 px-4 py-3 text-sm text-green-bright">
              {t('auth.inviteAccepted')}
            </div>
          )}

          {inviteStatus === 'failed' && (
            <div className="mb-4 rounded-sm border border-red-dim bg-red/8 px-4 py-3 text-sm text-red">
              {t('auth.inviteExpired')}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="lbl mb-2 block">{t('common.email')}</label>
              <input
                type="email"
                {...register('email')}
                className="w-full rounded-sm border border-border bg-surface px-4 py-3.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
                placeholder="email@example.cz"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="lbl mb-2 block">{t('auth.password')}</label>
              <input
                type="password"
                {...register('password')}
                className="w-full rounded-sm border border-border bg-surface px-4 py-3.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
                placeholder="••••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Forgot password */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-xs text-gold transition-colors hover:text-gold-bright"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-sm bg-gold px-4 py-4 font-heading text-[15px] font-extrabold uppercase tracking-[1.5px] text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {loading ? t('auth.loginLoading') : t('auth.login')}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm text-muted">
            {t('auth.noAccount')}{' '}
            <Link
              to="/register"
              state={{ fromInvite: hasPendingInvite || fromInvite }}
              className="text-gold transition-colors hover:text-gold-bright"
            >
              {t('auth.register')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
