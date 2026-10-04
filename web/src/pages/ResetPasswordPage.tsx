import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckIcon, TriangleAlertIcon } from 'lucide-react';
import { resetPassword } from '@/api/auth';
import { passwordMeetsAllRules } from '@/lib/password-rules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import PasswordStrengthRules from '@/components/entry/PasswordStrengthRules';

interface ResetPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

/** Shape of a FastEndpoints validation-failure entry — only `name` is read
 * here, to tell a `ResetPasswordValidator` field failure (`newPassword`)
 * apart from the endpoint's own uncoded anti-enumeration ThrowError. */
interface ValidationErrorEntry {
  name?: string;
}
interface ProblemDetailsBody {
  errors?: ValidationErrorEntry[];
}

/**
 * "/auth/reset-password" — own centred page (prototype `#scene-reset`,
 * scratchpad gf-register.html). Reads BOTH `token` and `email` from the
 * query, verbatim, ONCE — URLSearchParams already decodes; a second
 * decodeURIComponent() would corrupt a token containing a literal '%'.
 * Missing or malformed either one renders the invalid-link state
 * immediately: the form never renders and the API is never called
 * (design-review error path).
 *
 * `ResetPasswordEndpoint` returns ONE generic failure for an invalid,
 * expired, or already-used token AND for an unknown email alike —
 * deliberate anti-enumeration (#656). This page never tries to
 * distinguish those. The one exception is a weak-password rejection from
 * `ResetPasswordValidator`, which runs BEFORE that generic branch and
 * carries a field-level failure on `newPassword` — surfaced on the
 * password field instead of the generic banner. Reset does NOT revoke
 * sessions and does NOT sign the user in (`ResetPasswordEndpoint.cs:43-62`);
 * copy here must not claim either.
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [{ token, email }] = useState(() => ({
    token: searchParams.get('token'),
    email: searchParams.get('email'),
  }));

  const emailIsWellFormed = !!email && z.string().email().safeParse(email).success;
  const linkIsValid = !!token && emailIsWellFormed;

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
    formState: { errors, isValid },
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
  });

  const hasPasswordFieldError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) return false;
    const body = error.response?.data as ProblemDetailsBody | undefined;
    return !!body?.errors?.some((entry) => entry.name === 'newPassword');
  };

  const resolveBannerErrorMessage = (error: unknown): string | null => {
    if (axios.isAxiosError(error)) {
      if (hasPasswordFieldError(error)) {
        // Rendered on the password field instead — see passwordFieldErrorMessage below.
        return null;
      }
      if (error.response?.status === 429) {
        return t('errors.rateLimitRefresh');
      }
      if (!error.response) {
        return t('entry.resetPassword.errors.network');
      }
      if (error.response.status === 400) {
        return t('entry.resetPassword.errors.genericFailure');
      }
      return t('entry.resetPassword.errors.generic');
    }
    return t('entry.resetPassword.errors.generic');
  };

  const bannerErrorMessage = resetMutation.isError
    ? resolveBannerErrorMessage(resetMutation.error)
    : null;
  const passwordFieldErrorMessage =
    resetMutation.isError && hasPasswordFieldError(resetMutation.error)
      ? t('entry.resetPassword.errors.passwordField')
      : null;

  const onSubmit = (values: ResetPasswordFormValues) => {
    resetMutation.mutate(values);
  };

  const brandRow = (
    <CardHeader>
      <span className="flex size-7.5 items-center justify-center rounded-md bg-brand text-caption font-bold tracking-wide text-paper">
        {t('entry.brandMark')}
      </span>
      <span>{t('entry.brand')}</span>
    </CardHeader>
  );

  const shell = (children: ReactNode) => (
    <div className="relative flex min-h-screen items-center justify-center bg-paper p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(120%_70%_at_50%_0%,var(--color-green-soft)_0%,transparent_60%)]"
      />
      <Card className="relative">{children}</Card>
    </div>
  );

  if (!linkIsValid) {
    return shell(
      <>
        {brandRow}
        <div className="flex size-11.5 items-center justify-center rounded-full bg-danger-soft text-destructive">
          <TriangleAlertIcon className="size-5" />
        </div>
        <CardTitle>{t('entry.resetPassword.invalidLink.title')}</CardTitle>
        <CardDescription>{t('entry.resetPassword.invalidLink.lede')}</CardDescription>
        <CardContent>
          <Button type="button" className="w-full" onClick={() => navigate('/forgot-password')}>
            {t('entry.resetPassword.invalidLink.requestNew')}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/')}>
            {t('entry.resetPassword.invalidLink.cta')}
          </Button>
        </CardContent>
      </>
    );
  }

  if (resetMutation.isSuccess) {
    return shell(
      <>
        {brandRow}
        <div className="flex size-11.5 items-center justify-center rounded-full bg-green-soft text-green-ink">
          <CheckIcon className="size-5" />
        </div>
        <CardTitle>{t('entry.resetPassword.success.title')}</CardTitle>
        <CardDescription>{t('entry.resetPassword.success.lede')}</CardDescription>
        <CardContent>
          <Button type="button" className="w-full" onClick={() => navigate('/')}>
            {t('entry.resetPassword.success.cta')}
          </Button>
        </CardContent>
      </>
    );
  }

  return shell(
    <>
      {brandRow}
      <CardTitle>{t('entry.resetPassword.title')}</CardTitle>
      <CardDescription>{t('entry.resetPassword.lede')}</CardDescription>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex w-full flex-col gap-4 text-left"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-new-password">{t('entry.resetPassword.newPasswordLabel')}</Label>
          <Input
            id="reset-new-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.newPassword || !!passwordFieldErrorMessage}
            aria-describedby="reset-new-password-rules"
            {...register('newPassword')}
          />
          <div id="reset-new-password-rules">
            <PasswordStrengthRules password={newPassword} />
          </div>
          {passwordFieldErrorMessage && (
            <p className="text-meta text-destructive">{passwordFieldErrorMessage}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-confirm-password">
            {t('entry.resetPassword.confirmPasswordLabel')}
          </Label>
          <Input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p id="reset-confirm-password-error" className="text-meta text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {bannerErrorMessage && (
          <p role="alert" className="text-meta text-destructive">
            {bannerErrorMessage}
          </p>
        )}

        <Button type="submit" disabled={!isValid || resetMutation.isPending} className="w-full">
          {resetMutation.isPending
            ? t('entry.resetPassword.submitting')
            : t('entry.resetPassword.submit')}
        </Button>

        <div className="rounded-r-md border-l-3 border-border bg-sunken px-3.5 py-2.5 text-left text-meta text-muted-foreground">
          {t('entry.resetPassword.note')}
        </div>
      </form>
    </>
  );
}
