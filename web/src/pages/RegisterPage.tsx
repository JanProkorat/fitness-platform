import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { apiClient, ApiException } from '@/api/client';
import { cn } from '@/lib/cn';

type Step = 1 | 2 | 3 | 4;

type Role = 'Trainer' | 'Nutritionist';

const ROLES: { value: Role; icon: string; name: string; desc: string }[] = [
  { value: 'Trainer', icon: '🏋️', name: 'Trenér', desc: 'Vytvářím tréninkové plány pro klienty' },
  { value: 'Nutritionist', icon: '🥗', name: 'Nutriční specialista', desc: 'Sestavuji jídelníčky a řeším výživu' },
];

const PASSWORD_REQUIREMENTS = [
  { test: (v: string) => v.length >= 8, label: 'Alespoň 8 znaků' },
  { test: (v: string) => /[A-Z]/.test(v), label: 'Alespoň jedno velké písmeno (A–Z)' },
  { test: (v: string) => /[a-z]/.test(v), label: 'Alespoň jedno malé písmeno (a–z)' },
  { test: (v: string) => /[0-9]/.test(v), label: 'Alespoň jedna číslice (0–9)' },
];

function computePasswordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  return score;
}

function strengthClass(s: number): string {
  if (s <= 1) return 'weak';
  if (s <= 2) return 'medium';
  return 'strong';
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fromInvite = !!(location.state as { fromInvite?: boolean })?.fromInvite;

  const [step, setStep] = useState<Step>(fromInvite ? 2 : 1);
  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [healthConsent, setHealthConsent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Step 2 schema
  const step2Schema = z
    .object({
      firstName: z.string().min(1, t('validation.required')),
      lastName: z.string().min(1, t('validation.required')),
      email: z.string().email(t('validation.invalidEmail')),
      password: z
        .string()
        .min(8, t('validation.passwordMinLength'))
        .regex(/[a-z]/, t('validation.passwordLowercase'))
        .regex(/[A-Z]/, t('validation.passwordUppercase'))
        .regex(/[0-9]/, t('validation.passwordDigit')),
      confirmPassword: z.string().min(1, t('validation.confirmPassword')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validation.passwordsMismatch'),
      path: ['confirmPassword'],
    });

  type Step2Form = z.infer<typeof step2Schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
  } = useForm<Step2Form>({
    resolver: zodResolver(step2Schema),
    mode: 'onChange',
  });

  const passwordValue = watch('password') || '';
  const strength = useMemo(() => computePasswordStrength(passwordValue), [passwordValue]);

  const toggleRole = (role: Role) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const handleStep1Continue = () => {
    if (selectedRoles.size === 0) return;
    setStep(2);
  };

  const handleStep2Continue = async () => {
    const valid = await trigger();
    if (valid) setStep(3);
  };

  const handleBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2 && !fromInvite) setStep(1);
  };

  const onSubmit = async (data: Step2Form) => {
    if (!termsConsent || !healthConsent) return;
    setError(null);
    setLoading(true);
    try {
      const role = fromInvite ? 'Client' : (selectedRoles.has('Trainer') ? 'Trainer' : 'Nutritionist');
      await apiClient.registerEndpoint({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        role,
        gdprConsent: true,
      });
      setRegisteredEmail(data.email);
      setStep(4);
    } catch (err: unknown) {
      if (ApiException.isApiException(err)) {
        try {
          const parsed = JSON.parse(err.response);
          const messages = parsed.errors?.map((e: { message?: string }) => e.message).join(', ');
          setError(messages ?? t('auth.registerError'));
        } catch {
          setError(t('auth.registerError'));
        }
      } else {
        setError(t('auth.registerError'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Step indicator
  const renderStepIndicator = () => {
    const steps = [1, 2, 3] as const;
    return (
      <div className="auth-step-indicator">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div
              className={cn(
                'auth-step',
                step === s && 'active',
                step > s && 'done',
              )}
            >
              {step > s ? '✓' : s}
            </div>
            {i < steps.length - 1 && <div className="auth-step-line" />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // STEP 1 - Role Selection
  const renderStep1 = () => (
    <>
      <div className="auth-title">
        Vytvoření <span>účtu</span>
      </div>
      <div className="auth-sub">
        Kdo jste? Obsah aplikace přizpůsobíme vaší roli.
      </div>

      <div className="auth-role-grid">
        {ROLES.map((role) => (
          <button
            key={role.value}
            type="button"
            onClick={() => toggleRole(role.value)}
            className={cn(
              'auth-role-card',
              selectedRoles.has(role.value) && 'selected',
            )}
          >
            <div className="auth-role-icon">{role.icon}</div>
            <div className="auth-role-name">{role.name}</div>
            <div className="auth-role-desc">{role.desc}</div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, marginTop: -8, textAlign: 'center' }}>
        Můžete vybrat i obě role současně.
      </p>

      <button
        type="button"
        onClick={handleStep1Continue}
        disabled={selectedRoles.size === 0}
        className="btn-auth-primary"
        style={{ marginTop: 4 }}
      >
        Pokračovat →
      </button>

      <div className="auth-footer">
        Máte účet?{' '}
        <Link to="/login">Přihlaste se</Link>
      </div>
    </>
  );

  // STEP 2 - Account Details
  const renderStep2 = () => (
    <>
      <div className="auth-title">
        Vaše <span>údaje</span>
      </div>
      <div className="auth-sub">
        Vyplňte základní informace o účtu.
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
            <label className="form-label">Jméno</label>
            <input
              type="text"
              {...register('firstName')}
              className="auth-input"
              placeholder="Jan"
            />
            {errors.firstName && (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.firstName.message}</p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Příjmení</label>
            <input
              type="text"
              {...register('lastName')}
              className="auth-input"
              placeholder="Novák"
            />
            {errors.lastName && (
              <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            {...register('email')}
            className="auth-input"
            placeholder="vas@email.cz"
          />
          {errors.email && (
            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label">Heslo</label>
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
                <div key={req.label} className={cn('auth-pw-req', met && 'met')}>
                  <div className="auth-pw-req-dot">
                    {met && '✓'}
                  </div>
                  <span>{req.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm password */}
        <div className="form-group">
          <label className="form-label">Potvrďte heslo</label>
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
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
            <p style={{ marginTop: 4, fontSize: 12, color: 'var(--red)' }}>{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {!fromInvite && (
            <button
              type="button"
              onClick={handleBack}
              className="btn"
              style={{ padding: '10px 16px', fontSize: 14 }}
            >
              ← Zpět
            </button>
          )}
          <button
            type="button"
            onClick={handleStep2Continue}
            className="btn-auth-primary"
            style={{ flex: 1 }}
          >
            Pokračovat →
          </button>
        </div>
      </div>

      <div className="auth-footer">
        Máte účet?{' '}
        <Link to="/login">Přihlaste se</Link>
      </div>
    </>
  );

  // STEP 3 - Consent
  const renderStep3 = () => {
    const canSubmit = termsConsent && healthConsent && !loading;

    return (
      <>
        <div className="auth-title">
          Téměř <span>hotovo</span>
        </div>
        <div className="auth-sub">
          Přečtěte si podmínky a dokončete registraci.
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--red)', background: 'var(--red-bg)', fontSize: 13, color: 'var(--red)' }}>
            {error}
          </div>
        )}

        {/* Checkbox: Terms */}
        <label
          className="auth-checkbox-wrap"
          style={{ marginBottom: 8 }}
          onClick={(e) => {
            e.preventDefault();
            setTermsConsent(!termsConsent);
          }}
        >
          <div className={cn('auth-checkbox', termsConsent && 'checked')}>
            {termsConsent && '✓'}
          </div>
          <span className="auth-checkbox-text">
            Souhlasím s{' '}
            <span style={{ fontWeight: 500, color: 'var(--accent)' }}>obchodními podmínkami</span> a{' '}
            <span style={{ fontWeight: 500, color: 'var(--accent)' }}>zásadami ochrany soukromí</span>
          </span>
        </label>

        {/* Checkbox: Health data */}
        <label
          className="auth-checkbox-wrap"
          style={{ marginBottom: 8 }}
          onClick={(e) => {
            e.preventDefault();
            setHealthConsent(!healthConsent);
          }}
        >
          <div className={cn('auth-checkbox', healthConsent && 'checked')}>
            {healthConsent && '✓'}
          </div>
          <span className="auth-checkbox-text">
            Souhlasím se zpracováním zdravotních dat dle GDPR čl. 9
            (tělesné míry, výkonnostní záznamy, fotky pokroku)
          </span>
        </label>

        {/* Checkbox: Marketing (optional) */}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleBack}
            className="btn"
            style={{ padding: '10px 16px', fontSize: 14 }}
          >
            ← Zpět
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!canSubmit}
            className="btn-auth-primary"
            style={{ flex: 1 }}
          >
            {loading ? 'Vytvářím účet…' : 'Vytvořit účet'}
          </button>
        </div>
      </>
    );
  };

  // STEP 4 - Success
  const renderStep4 = () => (
    <div className="auth-success">
      {/* Success icon */}
      <div className="auth-success-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="auth-success-title">
        Účet byl vytvořen!
      </div>
      <div className="auth-success-text">
        Poslali jsme vám ověřovací email. Klikněte na odkaz v emailu
        pro aktivaci účtu.
      </div>

      {/* Email confirmation box */}
      <div style={{ marginTop: 20, borderRadius: 'var(--radius-md)', background: 'var(--bg2)', padding: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>Email odeslán na:</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{registeredEmail}</div>
      </div>

      {/* Go to login */}
      <Link
        to="/login"
        className="btn-auth-primary"
        style={{ marginTop: 16, textDecoration: 'none' }}
      >
        Přejít na přihlášení
      </Link>

      <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>
        Email nedorazil?{' '}
        <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, color: 'var(--blue)', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>
          Odeslat znovu
        </button>
      </div>
    </div>
  );

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
            <div className="auth-logo-sub">Fitness &amp; výživa</div>
          </div>
        </div>

        {/* Step indicator (hidden on step 4) */}
        {step !== 4 && renderStepIndicator()}

        {/* Step content */}
        <div className="auth-step-content" key={step}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
}
