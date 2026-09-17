import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckIcon } from 'lucide-react';
import { requestPasswordReset } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ForgotPasswordFormValues {
  email: string;
}

/**
 * Forgot-password form — one email field, rendered in the panel like login
 * and register (prototype `[data-form="forgot"]`, scratchpad
 * gf-register.html). `POST /auth/password/reset` ALWAYS returns 200
 * regardless of whether the account exists (anti-enumeration) — the
 * confirmation copy after submit must not imply the address was found.
 */
export default function ForgotPasswordForm() {
  const { t } = useTranslation();

  const forgotPasswordSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t('entry.forgotPassword.validation.emailRequired'))
          .email(t('entry.forgotPassword.validation.emailInvalid')),
      }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const requestMutation = useMutation({
    mutationFn: ({ email }: ForgotPasswordFormValues) => requestPasswordReset(email),
  });

  const resolveErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        return t('errors.rateLimitRefresh');
      }
      if (!error.response) {
        return t('entry.forgotPassword.errors.network');
      }
    }
    return t('entry.forgotPassword.errors.generic');
  };

  const errorMessage = requestMutation.isError ? resolveErrorMessage(requestMutation.error) : null;

  const onSubmit = (values: ForgotPasswordFormValues) => {
    requestMutation.mutate(values);
  };

  if (requestMutation.isSuccess) {
    return (
      <>
        <div className="flex size-11 items-center justify-center rounded-full bg-green-soft text-green-ink">
          <CheckIcon className="size-5" />
        </div>

        <div>
          <p className="text-auth-title font-bold text-ink">{t('entry.forgotPassword.sent.title')}</p>
          <p className="mt-1.5 text-meta text-muted-foreground">{t('entry.forgotPassword.sent.lede')}</p>
        </div>

        <p className="text-meta text-muted-foreground">
          <button
            type="button"
            onClick={() => requestMutation.reset()}
            className="font-medium text-brand hover:underline"
          >
            {t('entry.forgotPassword.sent.tryAnother')}
          </button>
        </p>

        <p className="text-meta text-muted-foreground">
          <Link to="/" className="font-medium text-brand hover:underline">
            {t('entry.forgotPassword.backToLogin')}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div>
        <h3 className="text-auth-title font-bold text-ink">{t('entry.forgotPassword.title')}</h3>
        <p className="mt-1.5 text-meta text-muted-foreground">{t('entry.forgotPassword.lede')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-forgot-email">{t('entry.forgotPassword.emailLabel')}</Label>
          <Input
            id="entry-forgot-email"
            type="email"
            autoComplete="email"
            placeholder={t('entry.forgotPassword.emailPlaceholder')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'entry-forgot-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="entry-forgot-email-error" className="text-meta text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        {errorMessage && (
          <p role="alert" className="text-meta text-destructive">
            {errorMessage}
          </p>
        )}

        <Button type="submit" disabled={requestMutation.isPending} className="w-full">
          {requestMutation.isPending
            ? t('entry.forgotPassword.submitting')
            : t('entry.forgotPassword.submit')}
        </Button>

        <div className="rounded-r-md border-l-3 border-border bg-sunken px-3.5 py-2.5 text-meta text-muted-foreground">
          {t('entry.forgotPassword.note')}
        </div>
      </form>

      <p className="text-meta text-muted-foreground">
        <Link to="/" className="font-medium text-brand hover:underline">
          {t('entry.forgotPassword.backToLogin')}
        </Link>
      </p>
    </>
  );
}
