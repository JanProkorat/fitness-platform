import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { apiClient } from '@/api/client';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'form' | 'sent'>('form');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    email: z.string().email(t('validation.invalidEmail')),
  });

  type ForgotForm = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: ForgotForm) => {
    setError(null);
    setLoading(true);
    try {
      await apiClient.requestPasswordResetEndpoint({ email: data.email });
      setStatus('sent');
    } catch {
      setError(t('auth.forgotPasswordError'));
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
          <h1 className="mb-1 text-2xl font-bold">
            {t('auth.forgotPasswordTitle')}
          </h1>
          <p className="mb-8 text-sm text-muted">
            {t('auth.forgotPasswordSubtitle')}
          </p>

          {status === 'sent' ? (
            <div className="text-center">
              <div className="mb-4 text-4xl">&#x2709;&#xFE0F;</div>
              <p className="mb-6 text-sm text-green-bright">
                {t('auth.forgotPasswordSuccess')}
              </p>
              <Link
                to="/login"
                className="text-sm text-gold transition-colors hover:text-gold-bright"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-sm border border-red-dim bg-red/8 px-4 py-3 text-sm text-red">
                  {error}
                </div>
              )}

              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                <div>
                  <label className="lbl mb-2 block">
                    {t('common.email')}
                  </label>
                  <input
                    type="email"
                    {...register('email')}
                    className="w-full rounded-sm border border-border bg-surface px-4 py-3.5 text-sm text-text outline-none transition-colors focus:border-gold/40"
                    placeholder="email@example.cz"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 w-full rounded-sm bg-gold px-4 py-4 font-heading text-[15px] font-extrabold uppercase tracking-[1.5px] text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
                >
                  {loading
                    ? t('auth.forgotPasswordLoading')
                    : t('auth.forgotPasswordSubmit')}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
