import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import api from '@/lib/api';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const registerSchema = z
    .object({
      firstName: z.string().min(1, t('validation.required')),
      lastName: z.string().min(1, t('validation.required')),
      email: z.string().email(t('validation.invalidEmail')),
      password: z.string().min(8, t('validation.passwordMin')),
      confirmPassword: z.string().min(1, t('validation.confirmPassword')),
      role: z.enum(['Trainer', 'Client'], { error: t('validation.selectRole') }),
      gdprConsent: z.literal(true, { error: t('validation.gdprRequired') }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });

  type RegisterForm = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'Trainer' },
    mode: 'onChange',
  });

  const allFilled =
    watch('firstName') &&
    watch('lastName') &&
    watch('email') &&
    watch('password') &&
    watch('confirmPassword') &&
    watch('gdprConsent') === true;

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/register', data);
      navigate('/login', {
        replace: true,
        state: { registered: true },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err
      ) {
        const res = (err as { response: { data?: { errors?: { message?: string }[] } } }).response;
        const messages = res.data?.errors?.map((e) => e.message).join(', ');
        setError(messages ?? t('auth.registerError'));
      } else {
        setError(t('auth.registerError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-sm border border-border bg-surface px-4 py-3.5 text-sm text-text outline-none transition-colors focus:border-gold/40';

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4 py-10"
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
          <h1 className="mb-1 text-2xl font-bold">{t('auth.registerTitle')}</h1>
          <p className="mb-8 text-sm text-muted">
            {t('auth.registerSubtitle')}
          </p>

          {error && (
            <div className="mb-4 rounded-sm border border-red-dim bg-red/8 px-4 py-3 text-sm text-red">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl mb-2 block">{t('auth.firstName')}</label>
                <input
                  type="text"
                  {...register('firstName')}
                  className={inputClass}
                  placeholder="Jan"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div>
                <label className="lbl mb-2 block">{t('auth.lastName')}</label>
                <input
                  type="text"
                  {...register('lastName')}
                  className={inputClass}
                  placeholder="Novák"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="lbl mb-2 block">{t('common.email')}</label>
              <input
                type="email"
                {...register('email')}
                className={inputClass}
                placeholder="email@example.cz"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="lbl mb-2 block">{t('auth.password')}</label>
              <input
                type="password"
                {...register('password')}
                className={inputClass}
                placeholder={t('auth.passwordPlaceholder')}
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="lbl mb-2 block">{t('auth.confirmPassword')}</label>
              <input
                type="password"
                {...register('confirmPassword')}
                className={inputClass}
                placeholder={t('auth.confirmPasswordPlaceholder')}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="lbl mb-2 block">{t('auth.role')}</label>
              <div className="flex gap-3">
                {(['Trainer', 'Client'] as const).map((role) => (
                  <label
                    key={role}
                    className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm border border-border bg-bg px-4 py-3 text-sm transition-colors has-[:checked]:border-gold/40 has-[:checked]:bg-gold/5"
                  >
                    <input
                      type="radio"
                      value={role}
                      {...register('role')}
                      className="accent-gold"
                    />
                    <span>{role === 'Trainer' ? t('auth.roleTrainer') : t('auth.roleClient')}</span>
                  </label>
                ))}
              </div>
              {errors.role && (
                <p className="mt-1 text-xs text-red">
                  {errors.role.message}
                </p>
              )}
            </div>

            {/* GDPR */}
            <label className="flex items-start gap-3 rounded-sm border border-border bg-bg px-4 py-3">
              <input
                type="checkbox"
                {...register('gdprConsent')}
                className="mt-0.5 accent-gold"
              />
              <span className="text-xs leading-relaxed text-text2">
                <Trans i18nKey="auth.gdprConsent">
                  I agree to the processing of personal and health data under <span className="text-gold">GDPR</span> for the purpose of providing fitness platform services.
                </Trans>
              </span>
            </label>
            {errors.gdprConsent && (
              <p className="-mt-2 text-xs text-red">
                {errors.gdprConsent.message}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !allFilled || !isValid}
              className="mt-2 w-full rounded-sm bg-gold px-4 py-4 font-heading text-[15px] font-extrabold uppercase tracking-[1.5px] text-black transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {loading ? t('auth.registerLoading') : t('auth.registerSubmit')}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-muted">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="text-gold transition-colors hover:text-gold-bright"
            >
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
