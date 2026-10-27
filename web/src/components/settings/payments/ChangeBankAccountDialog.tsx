import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Landmark, ShieldCheck } from 'lucide-react';
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
import { Field } from '@/components/profile/ProfileSection';
import { isValidIban, normalizeIban } from '@/components/settings/payments/iban';
import { useChangeBankAccount, useSendBankAccountCode } from '@/hooks/usePaymentSettingsQueries';
import { getErrorCode, getErrorStatus, getRfc7807ErrorCode, showSuccess } from '@/lib/api-errors';
import { groupIban } from '@/lib/payment-format';
import { useAuthStore } from '@/stores/auth';

const HOLDER_MAX = 100;

interface FormValues {
  iban: string;
  accountHolder: string;
  password: string;
  code: string;
}

type InlineField = 'iban' | 'password' | 'code';

/** Where a failed change shows its error; null means a banner in the dialog. */
function fieldForCode(code: string | null): InlineField | null {
  switch (code) {
    case 'INVALID_IBAN':
      return 'iban';
    case 'REAUTH_PASSWORD_REQUIRED':
    case 'INVALID_CURRENT_PASSWORD':
      return 'password';
    case 'REAUTH_CODE_REQUIRED':
    case 'REAUTH_CODE_INVALID':
      return 'code';
    default:
      return null;
  }
}

interface FormProps {
  currentIban: string | undefined;
  currentHolder: string | undefined;
  /** True when the account has a password; otherwise an emailed code proves it is the owner. */
  hasPassword: boolean;
  onClose: () => void;
}

function ChangeBankAccountForm({ currentIban, currentHolder, hasPassword, onClose }: FormProps) {
  const { t } = useTranslation();
  const email = useAuthStore((state) => state.user?.email ?? '');
  const changeMutation = useChangeBankAccount();
  const codeMutation = useSendBankAccountCode();
  const [banner, setBanner] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          iban: z
            .string()
            .min(1, t('payments.settings.bank.ibanRequired'))
            .refine(isValidIban, t('payments.settings.bank.ibanInvalid')),
          accountHolder: z
            .string()
            .trim()
            .min(1, t('payments.settings.bank.holderRequired'))
            .max(HOLDER_MAX, t('payments.settings.bank.holderTooLong', { max: HOLDER_MAX })),
          password: z.string(),
          code: z.string(),
        })
        .superRefine((values, ctx) => {
          if (hasPassword && values.password === '') {
            ctx.addIssue({ code: 'custom', path: ['password'], message: t('payments.settings.bank.passwordRequired') });
          }
          if (!hasPassword && values.code.trim() === '') {
            ctx.addIssue({ code: 'custom', path: ['code'], message: t('payments.settings.bank.codeRequired') });
          }
        }),
    [t, hasPassword],
  );

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { iban: '', accountHolder: currentHolder ?? '', password: '', code: '' },
  });

  const ibanValue = useWatch({ control, name: 'iban' });
  const ibanLooksValid = ibanValue.trim() !== '' && isValidIban(ibanValue);
  const rateLimited = getErrorStatus(changeMutation.error) === 429;
  const codeRateLimited = getErrorStatus(codeMutation.error) === 429;

  const submit = (values: FormValues) => {
    setBanner(null);
    changeMutation.mutate(
      {
        iban: normalizeIban(values.iban),
        accountHolder: values.accountHolder.trim(),
        password: hasPassword ? values.password : undefined,
        code: hasPassword ? undefined : values.code.trim(),
      },
      {
        onSuccess: () => {
          showSuccess('payments.settings.bank.success');
          onClose();
        },
        onError: (error) => {
          if (getErrorStatus(error) === 429) {
            return;
          }
          const code = getErrorCode(error) ?? getRfc7807ErrorCode(error);
          const field = fieldForCode(code);
          if (field) {
            setError(field, { message: t(`apiErrors.${code}`, { defaultValue: t('payments.settings.bank.error') }) });
            return;
          }
          setBanner(t('payments.settings.bank.error'));
        },
      },
    );
  };

  return (
    <>
      <DialogHeader className="flex-row items-start gap-3.5 pr-8 text-left">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink-2">
          <Landmark className="size-4.5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1.5">
          <DialogTitle className="text-lede font-bold">{t('payments.settings.bank.title')}</DialogTitle>
          <DialogDescription className="text-copy leading-normal">
            {t('payments.settings.bank.lede')}
          </DialogDescription>
        </div>
      </DialogHeader>

      <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <Field
          label={t('payments.settings.bank.newIban')}
          htmlFor="bank-iban"
          hint={
            ibanLooksValid
              ? t('payments.settings.bank.ibanChecked', { iban: groupIban(normalizeIban(ibanValue)) })
              : currentIban
                ? t('payments.settings.bank.ibanCurrent', { iban: groupIban(currentIban) })
                : undefined
          }
          error={errors.iban?.message}
        >
          <Input
            id="bank-iban"
            autoComplete="off"
            spellCheck={false}
            className="h-10 tabular-nums"
            aria-invalid={!!errors.iban}
            aria-describedby="bank-iban-message"
            {...register('iban')}
          />
        </Field>
        <Field label={t('payments.settings.bank.holder')} htmlFor="bank-holder" error={errors.accountHolder?.message}>
          <Input
            id="bank-holder"
            autoComplete="name"
            className="h-10"
            aria-invalid={!!errors.accountHolder}
            aria-describedby="bank-holder-message"
            {...register('accountHolder')}
          />
        </Field>

        {hasPassword ? (
          <Field
            label={t('payments.settings.bank.password')}
            htmlFor="bank-password"
            hint={t('payments.settings.bank.passwordHint')}
            error={errors.password?.message}
          >
            <Input
              id="bank-password"
              type="password"
              autoComplete="current-password"
              className="h-11 px-3.5"
              aria-invalid={!!errors.password}
              aria-describedby="bank-password-message"
              {...register('password')}
            />
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <Field
              label={t('payments.settings.bank.code')}
              htmlFor="bank-code"
              hint={codeMutation.isSuccess ? t('payments.settings.bank.codeSent', { email }) : t('payments.settings.bank.codeHint')}
              error={errors.code?.message}
            >
              <Input
                id="bank-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-11 px-3.5 tabular-nums"
                aria-invalid={!!errors.code}
                aria-describedby="bank-code-message"
                {...register('code')}
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              className="self-start font-semibold"
              disabled={codeMutation.isPending || codeRateLimited}
              onClick={() => codeMutation.mutate()}
            >
              {codeMutation.isPending
                ? t('payments.settings.bank.sendingCode')
                : codeMutation.isSuccess
                  ? t('payments.settings.bank.resendCode')
                  : t('payments.settings.bank.sendCode')}
            </Button>
            {codeRateLimited && (
              <p role="alert" className="text-meta text-error">
                {t('payments.settings.bank.rateLimited')}
              </p>
            )}
            {codeMutation.isError && !codeRateLimited && (
              <p role="alert" className="text-meta text-error">
                {t('payments.settings.bank.codeError')}
              </p>
            )}
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-field bg-sunken px-3.5 py-3 text-body leading-normal text-ink-2">
          <ShieldCheck className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t('payments.settings.bank.notice', { email })}</span>
        </div>

        {rateLimited && (
          <p role="alert" className="text-meta text-error">
            {t('payments.settings.bank.rateLimited')}
          </p>
        )}
        {banner && (
          <p role="alert" className="text-meta text-error">
            {banner}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="lg" disabled={changeMutation.isPending || rateLimited}>
            {changeMutation.isPending ? t('common.saving') : t('payments.settings.bank.submit')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentIban: string | undefined;
  currentHolder: string | undefined;
  hasPassword: boolean;
}

/** Sets or changes the bank account; proves ownership with the password, or an emailed code without one. */
export default function ChangeBankAccountDialog({ open, onOpenChange, currentIban, currentHolder, hasPassword }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-130 overflow-y-auto">
        <ChangeBankAccountForm
          currentIban={currentIban}
          currentHolder={currentHolder}
          hasPassword={hasPassword}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
