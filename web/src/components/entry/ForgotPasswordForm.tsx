import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ChevronLeftIcon, ClockIcon, KeyRoundIcon, MailIcon } from 'lucide-react';
import { requestPasswordReset } from '@/api/auth';
import { getRfc7807ErrorCode } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';
import EntryDialogTitle from '@/components/entry/EntryDialogTitle';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ForgotPasswordFormValues {
  email: string;
}

const EMAIL_NOT_REGISTERED = 'EMAIL_NOT_REGISTERED';

/**
 * Forgot-password dialog content: an email step, then a "check your email"
 * step. The sent step renders from `sentTo` (not the mutation state) so
 * "Send again" never flips back to the form. An unknown address comes back as
 * 404 EMAIL_NOT_REGISTERED and is shown inline under the field.
 */
export default function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);

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
    onSuccess: (_data, { email }) => setSentTo(email),
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
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

  const emailNotRegistered =
    requestMutation.isError && getRfc7807ErrorCode(requestMutation.error) === EMAIL_NOT_REGISTERED;
  const emailFieldInvalid = !!errors.email || emailNotRegistered;
  const errorMessage =
    requestMutation.isError && !emailNotRegistered
      ? resolveErrorMessage(requestMutation.error)
      : null;
  const resendErrorMessage = resendMutation.isError
    ? resolveErrorMessage(resendMutation.error)
    : null;

  const onSubmit = (values: ForgotPasswordFormValues) => {
    requestMutation.mutate(values);
  };

  const backLink = (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 self-center text-meta font-semibold text-ink"
    >
      <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
      {t('entry.forgotPassword.backToLogin')}
    </Link>
  );

  if (sentTo) {
    return (
      <>
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-ink">
            <MailIcon className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <EntryDialogTitle>{t('entry.forgotPassword.sent.title')}</EntryDialogTitle>
            <p className="mt-1 text-meta leading-normal text-muted-foreground">
              <Trans
                i18nKey="entry.forgotPassword.sent.lede"
                values={{ email: sentTo }}
                components={{ email: <strong className="font-semibold text-ink" /> }}
              />
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 rounded-xl bg-sunken px-3.5 py-3 text-meta leading-normal text-ink">
          <ClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p>{t('entry.forgotPassword.sent.info')}</p>
        </div>

        {resendErrorMessage && (
          <p role="alert" className="text-meta text-destructive">
            {resendErrorMessage}
          </p>
        )}

        <Button
          type="button"
          variant="outline"
          disabled={resendMutation.isPending}
          onClick={() => resendMutation.mutate(sentTo)}
          className="h-11.5 w-full rounded-xl bg-card text-subhead font-bold"
        >
          {resendMutation.isPending
            ? t('entry.forgotPassword.submitting')
            : t('entry.forgotPassword.sent.resend')}
        </Button>

        {backLink}
      </>
    );
  }

  return (
    <>
      <div className="flex items-start gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink">
          <KeyRoundIcon className="size-4.5" aria-hidden="true" />
        </div>
        <div>
          <EntryDialogTitle>{t('entry.forgotPassword.title')}</EntryDialogTitle>
          <p className="mt-1 text-meta leading-normal text-muted-foreground">
            {t('entry.forgotPassword.lede')}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entry-forgot-email">{t('entry.forgotPassword.emailLabel')}</Label>
          <Input
            id="entry-forgot-email"
            className="h-11 px-3.5 text-copy"
            type="email"
            autoComplete="email"
            placeholder={t('entry.forgotPassword.emailPlaceholder')}
            aria-invalid={emailFieldInvalid}
            aria-describedby={emailFieldInvalid ? 'entry-forgot-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="entry-forgot-email-error" className="text-meta text-destructive">
              {errors.email.message}
            </p>
          )}
          {!errors.email && emailNotRegistered && (
            <p id="entry-forgot-email-error" className="text-meta text-destructive">
              {t('entry.forgotPassword.errors.notRegistered')}{' '}
              <Link to="/register" className="font-semibold underline underline-offset-2">
                {t('entry.forgotPassword.createAccount')}
              </Link>
            </p>
          )}
        </div>

        {errorMessage && (
          <p role="alert" className="text-meta text-destructive">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={requestMutation.isPending}
          className="h-11.5 w-full rounded-xl text-subhead font-bold"
        >
          {requestMutation.isPending
            ? t('entry.forgotPassword.submitting')
            : t('entry.forgotPassword.submit')}
        </Button>
      </form>

      {backLink}
    </>
  );
}
