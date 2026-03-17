import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { apiClient, ApiException } from '@/api/client';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [status, setStatus] = useState<'form' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const schema = z
    .object({
      newPassword: z.string().min(8, t('validation.passwordMin')),
      confirmPassword: z.string().min(1, t('validation.required')),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: t('validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });

  type ResetForm = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
  });

  if (!token || !email) {
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
          <div className="rounded-sm border border-border bg-surface p-8 text-center">
            <div className="mb-4 text-4xl">&#x1F512;</div>
            <p className="mb-6 text-sm text-red">
              {t('auth.resetPasswordInvalidLink')}
            </p>
            <Link
              to="/login"
              className="text-sm text-gold transition-colors hover:text-gold-bright"
            >
              {t('auth.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ResetForm) => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await apiClient.resetPasswordEndpoint({
        token,
        email,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      setStatus('success');
    } catch (err) {
      if (ApiException.isApiException(err) && err.status === 400) {
        setErrorMsg(t('auth.resetPasswordError'));
      } else {
        setErrorMsg(t('auth.resetPasswordError'));
      }
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'success') {
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
          <div className="mb-10 text-center">
            <span className="font-heading text-2xl font-black uppercase tracking-[3px] text-gold">
              GF
            </span>
            <span className="font-heading text-2xl font-normal uppercase tracking-wide text-text2">
              {' '}
              Platform
            </span>
          </div>
          <div className="rounded-sm border border-border bg-surface p-8 text-center">
            <div className="mb-4 text-4xl">&#x2705;</div>
            <p className="mb-6 text-sm text-green-bright">
              {t('auth.resetPasswordSuccess')}
            </p>
            <Link
              to="/login"
              className="inline-block rounded-sm bg-gold px-6 py-3 font-heading text-[13px] font-extrabold uppercase tracking-[1.5px] text-black transition-colors hover:bg-gold-bright"
            >
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="mb-1 text-2xl font-bold">
            {t('auth.resetPasswordTitle')}
          </h1>
          <p className="mb-8 text-sm text-muted">
            {t('auth.resetPasswordSubtitle')}
          </p>

          {errorMsg && (
            <div className="mb-4 rounded-sm border border-red-dim bg-red/8 px-4 py-3 text-sm text-red">
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {/* New password */}
            <div>
              <label className="lbl mb-2 block">
                {t('auth.newPassword')}
              </label>
              <input
                type="password"
                {...register('newPassword')}
                className="w-full rounded-sm border border-border bg-surface px-4 py-3.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
                placeholder={t('auth.passwordPlaceholder')}
              />
              {errors.newPassword && (
                <p className="mt-1 text-xs text-red">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="lbl mb-2 block">
                {t('auth.confirmPassword')}
              </label>
              <input
                type="password"
                {...register('confirmPassword')}
                className="w-full rounded-sm border border-border bg-surface px-4 py-3.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
                placeholder={t('auth.confirmPasswordPlaceholder')}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-sm bg-gold px-4 py-4 font-heading text-[15px] font-extrabold uppercase tracking-[1.5px] text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {loading
                ? t('auth.resetPasswordLoading')
                : t('auth.resetPasswordSubmit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            <Link
              to="/login"
              className="text-gold transition-colors hover:text-gold-bright"
            >
              {t('auth.backToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
