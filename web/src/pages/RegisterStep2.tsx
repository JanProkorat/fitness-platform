import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { PASSWORD_REQUIREMENTS } from './register-types';
import { computePasswordStrength, strengthClass } from './register-helpers';

interface RegisterStep2Props {
  error: string | null;
  passwordValue: string;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onShowPasswordToggle: (show: boolean) => void;
  onShowConfirmPasswordToggle: (show: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
  fromInvite: boolean;
}

export function RegisterStep2({
  error,
  passwordValue,
  showPassword,
  showConfirmPassword,
  onShowPasswordToggle,
  onShowConfirmPasswordToggle,
  onBack,
  onContinue,
  fromInvite,
}: RegisterStep2Props) {
  const { register, formState: { errors } } = useFormContext();
  const { t } = useTranslation();
  const strength = useMemo(() => computePasswordStrength(passwordValue), [passwordValue]);

  return (
    <>
      <div className="auth-title">
        {t('auth.registerStep2HeroTitle')} <span>{t('auth.registerStep2HeroTitleHighlight')}</span>
      </div>
      <div className="auth-sub">
        {t('auth.registerStep2Subtitle')}
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Name row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('auth.firstName')}</label>
            <input
              type="text"
              {...register('firstName')}
              className="auth-input"
              placeholder={t('auth.firstNamePlaceholder')}
            />
            {errors.firstName && (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{String(errors.firstName.message ?? '')}</p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{t('auth.lastName')}</label>
            <input
              type="text"
              {...register('lastName')}
              className="auth-input"
              placeholder={t('auth.lastNamePlaceholder')}
            />
            {errors.lastName && (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{String(errors.lastName.message ?? '')}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label">{t('common.email')}</label>
          <input
            type="email"
            {...register('email')}
            className="auth-input"
            placeholder={t('auth.emailPlaceholder')}
          />
          {errors.email && (
            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{String(errors.email.message ?? '')}</p>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label">{t('auth.password')}</label>
          <div className="auth-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className="auth-input"
              placeholder="••••••••••"
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => onShowPasswordToggle(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {/* Strength bars */}
          {passwordValue.length > 0 && (
            <div className="auth-strength">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'auth-strength-bar',
                    i <= strength && strengthClass(strength),
                  )}
                />
              ))}
            </div>
          )}

          {/* Requirements checklist */}
          <div className="auth-pw-reqs">
            {PASSWORD_REQUIREMENTS.map((req) => {
              const met = req.test(passwordValue);
              return (
                <div key={req.labelKey} className={cn('auth-pw-req', met && 'met')}>
                  <div className="auth-pw-req-dot">
                    {met && '✓'}
                  </div>
                  <span>{t(req.labelKey)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm password */}
        <div className="form-group">
          <label className="form-label">{t('auth.confirmPasswordLabel')}</label>
          <div className="auth-password-wrap">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              {...register('confirmPassword')}
              className="auth-input"
              placeholder="••••••••••"
            />
            <button
              type="button"
              className="auth-eye-btn"
              onClick={() => onShowConfirmPasswordToggle(!showConfirmPassword)}
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{String(errors.confirmPassword.message ?? '')}</p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {!fromInvite && (
            <button
              type="button"
              onClick={onBack}
              className="btn"
              style={{ padding: '10px 16px', fontSize: 14 }}
            >
              {t('auth.backButton')}
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="btn-auth-primary"
            style={{ flex: 1 }}
          >
            {t('auth.continueButton')}
          </button>
        </div>
      </div>

      <div className="auth-footer">
        {t('auth.hasAccountRegister')}{' '}
        <Link to="/login">{t('auth.loginLinkText')}</Link>
      </div>
    </>
  );
}
