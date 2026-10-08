import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { changeMyPassword, profileKeys } from '@/api/profile';
import { requestPasswordReset } from '@/api/auth';
import { getErrorCode, showApiError, showError, showSuccess } from '@/lib/api-errors';
import { passwordMeetsAllRules } from '@/lib/password-rules';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordStrengthRules from '@/components/entry/PasswordStrengthRules';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  shown: boolean;
  onToggle: () => void;
  toggleLabel: string;
  error: string | undefined;
  registration: UseFormRegisterReturn;
  labelAside?: React.ReactNode;
}

function PasswordField({
  id,
  label,
  autoComplete,
  shown,
  onToggle,
  toggleLabel,
  error,
  registration,
  labelAside,
}: PasswordFieldProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder="••••••••"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-11 px-3.5 pr-16 text-copy"
          {...registration}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggleLabel}
          className="absolute inset-y-0 right-2 my-auto h-7.5 rounded-lg px-2 text-caption font-semibold text-ink-2"
        >
          {shown ? t('settings.account.passwordDialog.hide') : t('settings.account.passwordDialog.show')}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-meta text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function ChangePasswordForm({ email, onClose }: { email: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t('settings.account.passwordDialog.currentRequired')),
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
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword');

  const changeMutation = useMutation({
    mutationFn: changeMyPassword,
    onSuccess: (result) => {
      // The old refresh tokens are revoked, so the fresh pair must be stored before any further request.
      useAuthStore.getState().setTokens(result.accessToken, result.refreshToken);
      void queryClient.invalidateQueries({ queryKey: profileKeys.me });
      showSuccess('settings.account.passwordDialog.success');
      onClose();
    },
    onError: (error) => {
      if (getErrorCode(error) === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { message: t('settings.account.passwordDialog.wrongCurrent') });
        return;
      }
      showApiError(error, 'settings.account.passwordDialog.error');
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onError: () => showError('settings.account.passwordDialog.resetError'),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('settings.account.passwordDialog.title')}</DialogTitle>
        <DialogDescription>{t('settings.account.passwordDialog.lede')}</DialogDescription>
      </DialogHeader>

      <form
        noValidate
        onSubmit={handleSubmit((values) =>
          changeMutation.mutate({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
            confirmPassword: values.confirmPassword,
          })
        )}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <PasswordField
            id="change-current-password"
            label={t('settings.account.passwordDialog.current')}
            autoComplete="current-password"
            shown={showCurrent}
            onToggle={() => setShowCurrent((v) => !v)}
            toggleLabel={
              showCurrent
                ? t('settings.account.passwordDialog.hideCurrent')
                : t('settings.account.passwordDialog.showCurrent')
            }
            error={errors.currentPassword?.message}
            registration={register('currentPassword')}
            labelAside={
              resetMutation.isSuccess ? null : (
                <button
                  type="button"
                  onClick={() => resetMutation.mutate()}
                  disabled={resetMutation.isPending}
                  className="text-meta font-semibold text-ink-2 underline-offset-2 hover:underline disabled:opacity-60"
                >
                  {t('settings.account.passwordDialog.forgot')}
                </button>
              )
            }
          />
          {resetMutation.isSuccess && (
            <p role="status" className="text-meta text-success-ink">
              {t('settings.account.passwordDialog.resetSent', { email })}
            </p>
          )}
        </div>

        <PasswordField
          id="change-new-password"
          label={t('settings.account.passwordDialog.new')}
          autoComplete="new-password"
          shown={showNew}
          onToggle={() => setShowNew((v) => !v)}
          toggleLabel={
            showNew
              ? t('settings.account.passwordDialog.hideNew')
              : t('settings.account.passwordDialog.showNew')
          }
          error={errors.newPassword?.message}
          registration={register('newPassword')}
        />

        <PasswordStrengthRules password={newPassword} />

        <PasswordField
          id="change-confirm-password"
          label={t('settings.account.passwordDialog.repeat')}
          autoComplete="new-password"
          shown={showRepeat}
          onToggle={() => setShowRepeat((v) => !v)}
          toggleLabel={
            showRepeat
              ? t('settings.account.passwordDialog.hideRepeat')
              : t('settings.account.passwordDialog.showRepeat')
          }
          error={errors.confirmPassword?.message}
          registration={register('confirmPassword')}
        />

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="lg" disabled={changeMutation.isPending}>
            {changeMutation.isPending
              ? t('settings.account.passwordDialog.submitting')
              : t('settings.account.passwordDialog.submit')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export default function ChangePasswordDialog({ open, onOpenChange, email }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] max-w-125 overflow-y-auto">
        <ChangePasswordForm email={email} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
