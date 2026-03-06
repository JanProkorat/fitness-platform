import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import api from '@/lib/api';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const justRegistered = (location.state as { registered?: boolean })?.registered;

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
    setError(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      login(
        {
          publicId: res.data.publicId,
          email: res.data.email,
          firstName: res.data.firstName,
          lastName: res.data.lastName,
          roles: res.data.roles,
        },
        res.data.accessToken,
        res.data.refreshToken,
      );
      navigate('/dashboard', { replace: true });
    } catch {
      setError(t('auth.loginError'));
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

          {error && (
            <div className="mb-4 rounded-sm border border-red-dim bg-red/8 px-4 py-3 text-sm text-red">
              {error}
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
              <a
                href="/auth/forgot-password"
                className="text-xs text-gold transition-colors hover:text-gold-bright"
              >
                {t('auth.forgotPassword')}
              </a>
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
