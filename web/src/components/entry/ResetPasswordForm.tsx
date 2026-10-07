import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckIcon, ChevronLeftIcon, ClockIcon, LockIcon } from 'lucide-react';
import { resetPassword } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';
import { passwordMeetsAllRules } from '@/lib/password-rules';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EntryDialogTitle from '@/components/entry/EntryDialogTitle';
import PasswordStrengthRules from '@/components/entry/PasswordStrengthRules';

interface ResetPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

type Outcome = 'done' | 'expired' | null;

interface ProblemDetailsBody {
  errors?: { name?: string }[];
}

/** True when the 400 carries a `ResetPasswordValidator` failure on `newPassword`. */
function hasPasswordFieldError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const body = error.response?.data as ProblemDetailsBody | undefined;
  return !!body?.errors?.some((entry) => entry.name?.toLowerCase() === 'newpassword');
}

interface StepHeaderProps {
  tileClassName: string;
  icon: ReactNode;
  title: string;
  lede: string;
}

function StepHeader({ tileClassName, icon, title, lede }: StepHeaderProps) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl',
          tileClassName
        )}
      >
        {icon}
      </div>
      <div>
        <EntryDialogTitle>{title}</EntryDialogTitle>
        <p className="mt-1 text-meta leading-normal text-muted-foreground">{lede}</p>
      </div>
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  toggleLabel: string;
  shown: boolean;
  onToggle: () => void;
  invalid: boolean;
  describedBy?: string;
  registration: UseFormRegisterReturn;
  showText: string;
  hideText: string;
}

function PasswordField({
  id,
  label,
  toggleLabel,
  shown,
  onToggle,
  invalid,
  describedBy,
  registration,
  showText,
  hideText,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="h-11 px-3.5 pr-16 text-copy"
          {...registration}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          className="absolute inset-y-0 right-2 my-auto h-7.5 rounded-lg px-2 text-caption font-semibold text-ink-2"
        >
          {shown ? hideText : showText}
        </button>
      </div>
    </div>
  );
}

/**
 * Reset-password dialog content at "/auth/reset-password" (the emailed link:
 * `?token=…&email=…`). Three steps: new password, done, expired.
 *
 * Token and email are read once in a state initializer — URLSearchParams
 * already decodes, so a second decode would corrupt a token containing '%' —
 * and a missing or malformed either one goes straight to the expired step
 * without calling the API.
 *
 * The endpoint answers one generic 400 for a bad, expired or used token and
 * for an unknown email alike (anti-enumeration), so any 400 without a
 * `newPassword` field error means "expired". A weak-password 400 stays on the
 * form as a field error; 429 and network failures show a banner on the form.
 * On success the refresh tokens are already revoked server-side, so the store
 * is only cleared locally.
 */
export default function ResetPasswordForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const logout = useAuthStore((s) => s.logout);
  const [{ token, email }] = useState(() => {
    const rawToken = searchParams.get('token');
    const rawEmail = searchParams.get('email');
    const valid = !!rawToken && !!rawEmail && z.string().email().safeParse(rawEmail).success;
    return { token: valid ? rawToken : null, email: valid ? rawEmail : null };
  });
  const [outcome, setOutcome] = useState<Outcome>(token && email ? null : 'expired');
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  const resetSchema = useMemo(
    () =>
      z
        .object({
          newPassword: z
            .string()
            .refine(passwordMeetsAllRules, t('entry.resetPassword.validation.passwordInvalid')),
          confirmPassword: z.string().min(1, t('entry.resetPassword.validation.confirmRequired')),
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          message: t('entry.resetPassword.validation.confirmMismatch'),
          path: ['confirmPassword'],
        }),
    [t]
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');

  const resetMutation = useMutation({
    mutationFn: (values: ResetPasswordFormValues) =>
      resetPassword({
        token: token ?? '',
        email: email ?? '',
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      }),
    onSuccess: () => {
      logout();
      setOutcome('done');
    },
    onError: (error) => {
      const isGenericRejection =
        axios.isAxiosError(error) &&
        error.response?.status === 400 &&
        !hasPasswordFieldError(error);
      if (isGenericRejection) setOutcome('expired');
    },
  });

  const resolveBannerMessage = (error: unknown): string | null => {
    if (hasPasswordFieldError(error)) return null;
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) return t('errors.rateLimitRefresh');
      if (!error.response) return t('entry.resetPassword.errors.network');
    }
    return t('entry.resetPassword.errors.generic');
  };

  const bannerMessage = resetMutation.isError ? resolveBannerMessage(resetMutation.error) : null;
  const passwordFieldMessage =
    resetMutation.isError && hasPasswordFieldError(resetMutation.error)
      ? t('entry.resetPassword.errors.passwordField')
      : null;
  const newPasswordInvalid = !!errors.newPassword || !!passwordFieldMessage;

  if (outcome === 'done') {
    return (
      <>
        <StepHeader
          tileClassName="bg-success-soft text-success-ink"
          icon={<CheckIcon className="size-4.5" aria-hidden="true" />}
          title={t('entry.resetPassword.done.title')}
          lede={t('entry.resetPassword.done.lede')}
        />
        <Button
          type="button"
          onClick={() => navigate('/login')}
          className="h-11.5 w-full rounded-xl text-subhead font-bold"
        >
          {t('entry.resetPassword.done.cta')}
        </Button>
      </>
    );
  }

  if (outcome === 'expired') {
    return (
      <>
        <StepHeader
          tileClassName="bg-error-soft text-destructive"
          icon={<ClockIcon className="size-4.5" aria-hidden="true" />}
          title={t('entry.resetPassword.expired.title')}
          lede={t('entry.resetPassword.expired.lede')}
        />
        <Button
          type="button"
          onClick={() => navigate('/forgot-password')}
          className="h-11.5 w-full rounded-xl text-subhead font-bold"
        >
          {t('entry.resetPassword.expired.cta')}
        </Button>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 self-center text-meta font-semibold text-ink"
        >
          <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
          {t('entry.resetPassword.expired.backToLogin')}
        </Link>
      </>
    );
  }

  return (
    <>
      <StepHeader
        tileClassName="bg-sunken text-ink"
        icon={<LockIcon className="size-4.5" aria-hidden="true" />}
        title={t('entry.resetPassword.title')}
        lede={t('entry.resetPassword.lede', { email })}
      />

      <form
        onSubmit={handleSubmit((values) => resetMutation.mutate(values))}
        noValidate
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <PasswordField
            id="reset-new-password"
            label={t('entry.resetPassword.newPasswordLabel')}
            toggleLabel={
              showNew
                ? t('entry.resetPassword.hideNewPassword')
                : t('entry.resetPassword.showNewPassword')
            }
            shown={showNew}
            onToggle={() => setShowNew((v) => !v)}
            invalid={newPasswordInvalid}
            describedBy={newPasswordInvalid ? 'reset-new-password-error' : undefined}
            registration={register('newPassword')}
            showText={t('entry.resetPassword.show')}
            hideText={t('entry.resetPassword.hide')}
          />
          {(errors.newPassword || passwordFieldMessage) && (
            <p id="reset-new-password-error" className="text-meta text-destructive">
              {passwordFieldMessage ?? errors.newPassword?.message}
            </p>
          )}
        </div>

        <PasswordStrengthRules password={newPassword} />

        <div className="flex flex-col gap-1.5">
          <PasswordField
            id="reset-confirm-password"
            label={t('entry.resetPassword.confirmPasswordLabel')}
            toggleLabel={
              showRepeat
                ? t('entry.resetPassword.hideRepeatPassword')
                : t('entry.resetPassword.showRepeatPassword')
            }
            shown={showRepeat}
            onToggle={() => setShowRepeat((v) => !v)}
            invalid={!!errors.confirmPassword}
            describedBy={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
            registration={register('confirmPassword')}
            showText={t('entry.resetPassword.show')}
            hideText={t('entry.resetPassword.hide')}
          />
          {errors.confirmPassword && (
            <p id="reset-confirm-password-error" className="text-meta text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {bannerMessage && (
          <p role="alert" className="text-meta text-destructive">
            {bannerMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={resetMutation.isPending}
          className="h-11.5 w-full rounded-xl text-subhead font-bold"
        >
          {resetMutation.isPending
            ? t('entry.resetPassword.submitting')
            : t('entry.resetPassword.submit')}
        </Button>
      </form>
    </>
  );
}
