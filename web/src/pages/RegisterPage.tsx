import { useState } from 'react';
import { useForm, FormProvider, type SubmitHandler, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { apiClient, ApiException } from '@/api/client';
import { RegisterStepIndicator } from './RegisterStepIndicator';
import { RegisterStep1 } from './RegisterStep1';
import { RegisterStep2 } from './RegisterStep2';
import { RegisterStep3 } from './RegisterStep3';
import { RegisterStep4 } from './RegisterStep4';
import { type Step, type Role } from './register-types';

type Step2Form = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

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

  // Build schema with translations
  const localizedStep2Schema = z
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

  const methods = useForm<Step2Form>({
    resolver: zodResolver(localizedStep2Schema),
    mode: 'onChange',
  });

  const { watch, trigger } = methods;
  const passwordValue = watch('password') || '';

  const handleToggleRole = (role: Role) => {
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const handleStep1Continue = () => {
    if (selectedRoles.size === 0) return;
    setError(null);
    setStep(2);
  };

  const handleStep2Continue = async () => {
    const valid = await trigger();
    if (valid) {
      setError(null);
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 3) setStep(2);
    else if (step === 2 && !fromInvite) setStep(1);
  };

  const onSubmit: SubmitHandler<FieldValues> = async (raw) => {
    const data = raw as Step2Form;
    if (!termsConsent) return;
    if (fromInvite && !healthConsent) return;
    setError(null);
    setLoading(true);
    try {
      const roles: string[] = fromInvite
        ? ['Client']
        : Array.from(selectedRoles); // selectedRoles is Set<Role>; Role = 'Trainer' | 'Nutritionist' — matches backend UserRole names
      await apiClient.registerEndpoint({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        roles,
        gdprConsent: true,
        // Art. 9 health-data consent: required for Client (fromInvite path), must be null for coach roles
        healthDataConsent: fromInvite ? true : undefined,
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


  return (
    <FormProvider {...methods}>
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

          {/* Step indicator (hidden on step 4) */}
          {step !== 4 && <RegisterStepIndicator step={step} />}

          {/* Step content */}
          <div className="auth-step-content" key={step}>
            {step === 1 && (
              <RegisterStep1
                selectedRoles={selectedRoles}
                onToggleRole={handleToggleRole}
                onContinue={handleStep1Continue}
              />
            )}
            {step === 2 && (
              <RegisterStep2
                error={error}
                passwordValue={passwordValue}
                showPassword={showPassword}
                showConfirmPassword={showConfirmPassword}
                onShowPasswordToggle={setShowPassword}
                onShowConfirmPasswordToggle={setShowConfirmPassword}
                onBack={handleBack}
                onContinue={handleStep2Continue}
                fromInvite={fromInvite}
              />
            )}
            {step === 3 && (
              <RegisterStep3
                error={error}
                loading={loading}
                termsConsent={termsConsent}
                healthConsent={healthConsent}
                requireHealthConsent={fromInvite}
                onTermsConsentChange={setTermsConsent}
                onHealthConsentChange={setHealthConsent}
                onBack={handleBack}
                onSubmit={onSubmit}
              />
            )}
            {step === 4 && <RegisterStep4 email={registeredEmail} />}
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
