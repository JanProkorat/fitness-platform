import { forwardRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { apiClient, ApiException } from '@/api/client';
import { cn } from '@/lib/cn';
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';
import { PASSWORD_REQUIREMENTS } from './register-types';

const PasswordInput = forwardRef<
  HTMLInputElement,
  { id: string; placeholder: string } & React.InputHTMLAttributes<HTMLInputElement>
>(({ id, placeholder, ...props }, ref) => {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-password-wrap">
      <input
        ref={ref}
        id={id}
        type={show ? 'text' : 'password'}
        className="auth-input"
        placeholder={placeholder}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="auth-eye-btn"
      >
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        )}
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

function PasswordRequirements({ password }: { password: string }) {
  const { t } = useTranslation();
  return (
    <div className="auth-pw-reqs">
      {PASSWORD_REQUIREMENTS.map(({ test, labelKey }) => {
        const met = test(password);
        return (
          <div key={labelKey} className={cn('auth-pw-req', met && 'met')}>
            <span className="auth-pw-req-dot">
              {met ? '✓' : ''}
            </span>
            {t(labelKey)}
          </div>
        );
      })}
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const [step, setStep] = useState<'form' | 'success' | 'error'>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const schema = z
    .object({
      newPassword: z
        .string()
        .min(8, t('validation.passwordMinLength'))
        .regex(/[a-z]/, t('validation.passwordLowercase'))
        .regex(/[A-Z]/, t('validation.passwordUppercase'))
        .regex(/[0-9]/, t('validation.passwordDigit')),
      confirmPassword: z.string().min(1, t('validation.confirmPassword')),
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
    watch,
  } = useForm<ResetForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  const watchedPassword = watch('newPassword') || '';

  // Invalid link state
  if (!token || !email) {
    return (
      <div className="auth-wrap">
        <div className="absolute top-4 right-4" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <DarkModeToggle />
          <LanguageSwitcher />
        </div>
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="mb-4 text-4xl">&#x1F512;</div>
          <p className="mb-6 text-sm text-red">
            {t('auth.resetPasswordInvalidLink')}
          </p>
          <Link to="/login" className="auth-back">
            {t('auth.backToLogin')}
          </Link>
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
      setStep('success');
    } catch (err) {
      if (ApiException.isApiException(err) && err.status === 400) {
        setErrorMsg(t('auth.resetPasswordError'));
      } else {
        setErrorMsg(t('auth.resetPasswordError'));
      }
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (step === 'success') {
    return (
      <div className="auth-wrap">
        <div className="absolute top-4 right-4" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <DarkModeToggle />
          <LanguageSwitcher />
        </div>
        <div className="auth-card">
          <div className="auth-success">
            <div className="auth-success-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="auth-success-title">
              {t('auth.resetPasswordSuccessTitle')}
            </h1>
            <p className="auth-success-text">
              {t('auth.resetPasswordSuccessText')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="btn-auth-primary"
            style={{ marginTop: '24px' }}
          >
            {t('auth.goToLoginButton')}
          </button>
        </div>
      </div>
    );
  }

  // Form state (also handles error state — shows form with error message)
  return (
    <div className="auth-wrap">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="auth-card">
        {/* Title */}
        <h1 className="auth-title">
          {t('auth.resetPasswordFormHeroTitle')} <span>{t('auth.resetPasswordFormHeroTitleHighlight')}</span>
        </h1>
        <p className="auth-sub">
          {t('auth.resetPasswordFormSubtitle')}
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-md border border-red bg-red-bg px-4 py-3 text-sm text-red">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* New password */}
          <div className="form-group">
            <label htmlFor="newPassword" className="form-label">
              {t('auth.newPassword')}
            </label>
            <PasswordInput
              id="newPassword"
              placeholder={t('auth.newPasswordPlaceholder')}
              {...register('newPassword')}
            />
            <PasswordStrengthMeter password={watchedPassword} />
            <PasswordRequirements password={watchedPassword} />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-red">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              {t('auth.confirmPassword')}
            </label>
            <PasswordInput
              id="confirmPassword"
              placeholder={t('auth.confirmNewPasswordPlaceholder')}
              {...register('confirmPassword')}
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
            className="btn-auth-primary"
          >
            {loading ? t('auth.savingEllipsis') : t('auth.saveNewPasswordButton')}
          </button>
        </form>
      </div>
    </div>
  );
}
