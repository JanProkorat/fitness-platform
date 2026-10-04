import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckIcon } from 'lucide-react';
import { resendVerificationAnonymous } from '@/api/auth';
import { Button } from '@/components/ui/button';

interface VerificationSentStateProps {
  email: string;
  onWrongEmail: () => void;
}

/**
 * "Check your email" result state (prototype `[data-form="sent"]`,
 * scratchpad gf-register.html). Rendered by RegisterForm on
 * `registerMutation.isSuccess` — it is not a route; the URL stays
 * `/register` (design-review error path: a reload must degrade back to
 * the empty register form, so this component never persists `email`
 * anywhere beyond its own props).
 */
export default function VerificationSentState({ email, onWrongEmail }: VerificationSentStateProps) {
  const { t } = useTranslation();
  const [resendConfirmed, setResendConfirmed] = useState(false);

  const resendMutation = useMutation({
    mutationFn: () => resendVerificationAnonymous(email),
    onSuccess: () => setResendConfirmed(true),
  });

  const resendErrorMessage = (): string | null => {
    if (!resendMutation.isError) return null;
    if (axios.isAxiosError(resendMutation.error)) {
      if (resendMutation.error.response?.status === 429) {
        return t('errors.rateLimitRefresh');
      }
      if (!resendMutation.error.response) {
        return t('entry.register.errors.network');
      }
    }
    return t('entry.register.errors.generic');
  };

  const errorMessage = resendErrorMessage();

  const handleResend = () => {
    setResendConfirmed(false);
    resendMutation.mutate();
  };

  return (
    <>
      <div className="flex size-11 items-center justify-center rounded-full bg-green-soft text-green-ink">
        <CheckIcon className="size-5" />
      </div>

      <div>
        <p className="text-auth-title font-bold text-ink">{t('entry.register.sent.title')}</p>
        <p className="mt-1.5 text-meta text-muted-foreground">
          {t('entry.register.sent.lede', { email })}
        </p>
      </div>

      <div className="rounded-r-md border-l-3 border-border bg-sunken px-3.5 py-2.5 text-meta text-muted-foreground">
        {t('entry.register.sent.note')}
      </div>

      {errorMessage && (
        <p role="alert" className="text-meta text-destructive">
          {errorMessage}
        </p>
      )}

      {resendConfirmed && !errorMessage && (
        <p role="status" className="text-meta text-green-ink">
          {t('entry.register.sent.resendConfirmation')}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={resendMutation.isPending}
        onClick={handleResend}
        className="w-full"
      >
        {resendMutation.isPending
          ? t('entry.register.sent.resending')
          : t('entry.register.sent.resend')}
      </Button>

      <p className="text-meta text-muted-foreground">
        {t('entry.register.sent.wrongEmail')}{' '}
        <button
          type="button"
          onClick={onWrongEmail}
          className="font-medium text-brand hover:underline"
        >
          {t('entry.register.sent.changeEmail')}
        </button>
      </p>
    </>
  );
}
