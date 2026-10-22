import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/components/profile/ProfileSection';
import SettingsCard from '@/components/settings/SettingsCard';
import ChangeBankAccountDialog from '@/components/settings/payments/ChangeBankAccountDialog';
import PaymentsPaywall from '@/components/client-detail/payment/PaymentsPaywall';
import { isNotEntitled } from '@/components/client-detail/payment/paymentErrors';
import {
  PaymentCurrency,
  PaymentMessageFormat,
  VariableSymbolFormat,
  type PaymentSettingsDto,
  type UpdatePaymentSettingsRequest,
} from '@/api/payment-settings';
import { getMyProfile, profileKeys } from '@/api/profile';
import { usePaymentSettings, useUpdatePaymentSettings } from '@/hooks/usePaymentSettingsQueries';
import { getErrorStatus, showApiError } from '@/lib/api-errors';
import { formatClientDate } from '@/lib/date-format';
import { groupIban } from '@/lib/payment-format';
import PackagesSummaryCard from '@/components/settings/payments/PackagesSummaryCard';

const DUE_DAY_OPTIONS = [3, 7, 10, 14, 21, 30] as const;

const SELECT_CLASS =
  'h-10 w-full appearance-none rounded-field border border-input bg-background pr-9 pl-3 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60';

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

/** The whole defaults block, as the endpoint replaces it; one field changes, the rest ride along. */
function withChange(settings: PaymentSettingsDto, change: Partial<UpdatePaymentSettingsRequest>): UpdatePaymentSettingsRequest {
  return {
    paymentDueDays: settings.paymentDueDays,
    messageFormat: settings.messageFormat,
    variableSymbolFormat: settings.variableSymbolFormat,
    profileCurrency: settings.profileCurrency,
    ...change,
  };
}

interface BodyProps {
  settings: PaymentSettingsDto;
}

function PaymentsBody({ settings }: BodyProps) {
  const { t, i18n } = useTranslation();
  const [bankOpen, setBankOpen] = useState(false);
  const meQuery = useQuery({ queryKey: profileKeys.me, queryFn: getMyProfile });
  const updateMutation = useUpdatePaymentSettings();

  // While a save is in flight the selects show the pending value; on failure they fall back to the stored one.
  const pending = updateMutation.isPending ? updateMutation.variables : undefined;
  const dueDays = pending?.paymentDueDays ?? settings.paymentDueDays ?? 7;
  const messageFormat = pending?.messageFormat ?? settings.messageFormat ?? PaymentMessageFormat.PackageNameAndMonth;
  const variableSymbolFormat =
    pending?.variableSymbolFormat ?? settings.variableSymbolFormat ?? VariableSymbolFormat.YearMonthClientNumber;
  const currency = pending?.profileCurrency ?? settings.profileCurrency ?? PaymentCurrency.CZK;

  const save = (change: Partial<UpdatePaymentSettingsRequest>) =>
    updateMutation.mutate(withChange(settings, change), {
      onError: (error) => showApiError(error, 'payments.settings.saveError'),
    });

  const dueDayChoices = DUE_DAY_OPTIONS.includes(dueDays as (typeof DUE_DAY_OPTIONS)[number])
    ? [...DUE_DAY_OPTIONS]
    : [...DUE_DAY_OPTIONS, dueDays].sort((a, b) => a - b);

  const hasAccount = Boolean(settings.iban);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <Field
          label={t('payments.settings.iban')}
          htmlFor="payments-iban"
          hint={t('payments.settings.ibanHint')}
        >
          <div className="relative">
            <Lock
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="payments-iban"
              readOnly
              value={hasAccount ? groupIban(settings.iban) : ''}
              placeholder={t('payments.settings.noAccount')}
              aria-describedby="payments-iban-message"
              className="h-10 pl-9.5 text-muted-foreground tabular-nums"
            />
          </div>
        </Field>
        <Field label={t('payments.settings.holder')} htmlFor="payments-holder" hint={t('payments.settings.holderHint')}>
          <Input
            id="payments-holder"
            readOnly
            value={settings.accountHolder ?? ''}
            aria-describedby="payments-holder-message"
            className="h-10 text-muted-foreground"
          />
        </Field>
      </div>

      <div className="flex items-center gap-4 rounded-xl bg-sunken px-4 py-3.5">
        <ShieldCheck className="size-4.5 shrink-0 text-success" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.75">
          <h3 className="text-copy font-semibold text-ink">
            {hasAccount ? t('payments.settings.protected') : t('payments.settings.addAccountTitle')}
          </h3>
          <p className="text-body text-muted-foreground">
            {hasAccount
              ? t('payments.settings.protectedHint', {
                  date: settings.bankAccountChangedAt
                    ? formatClientDate(settings.bankAccountChangedAt, i18n.language, 'short')
                    : '—',
                })
              : t('payments.settings.addAccountHint')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={meQuery.isPending}
          onClick={() => setBankOpen(true)}
          className="ml-auto h-9 shrink-0 rounded-field px-3.5 font-semibold"
        >
          {hasAccount ? t('payments.settings.changeAccount') : t('payments.settings.addAccount')}
        </Button>
      </div>

      <div className="grid gap-4 border-t border-border pt-4.5 sm:grid-cols-3">
        <Field label={t('payments.settings.due')} htmlFor="payments-due" hint={t('payments.settings.dueHint')}>
          <div className="relative">
            <select
              id="payments-due"
              className={SELECT_CLASS}
              value={dueDays}
              disabled={updateMutation.isPending}
              aria-describedby="payments-due-message"
              onChange={(event) => save({ paymentDueDays: Number(event.target.value) })}
            >
              {dueDayChoices.map((days) => (
                <option key={days} value={days}>
                  {t('payments.settings.dueOption', { count: days })}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </Field>
        <Field
          label={t('payments.settings.message')}
          htmlFor="payments-message"
          hint={t(`payments.settings.messageExample.${messageFormat}`)}
        >
          <div className="relative">
            <select
              id="payments-message"
              className={SELECT_CLASS}
              value={messageFormat}
              disabled={updateMutation.isPending}
              aria-describedby="payments-message-message"
              onChange={(event) => save({ messageFormat: event.target.value as PaymentMessageFormat })}
            >
              {Object.values(PaymentMessageFormat).map((format) => (
                <option key={format} value={format}>
                  {t(`payments.settings.messageFormat.${format}`)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </Field>
        <Field label={t('payments.settings.symbol')} htmlFor="payments-symbol" hint={t('payments.settings.symbolHint')}>
          <div className="relative">
            <select
              id="payments-symbol"
              className={SELECT_CLASS}
              value={variableSymbolFormat}
              disabled={updateMutation.isPending}
              aria-describedby="payments-symbol-message"
              onChange={(event) => save({ variableSymbolFormat: event.target.value as VariableSymbolFormat })}
            >
              {Object.values(VariableSymbolFormat).map((format) => (
                <option key={format} value={format}>
                  {t(`payments.settings.symbolFormat.${format}`)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </Field>
      </div>

      <div className="grid gap-4 border-t border-border pt-4.5 sm:grid-cols-3">
        <Field label={t('payments.settings.currency')} htmlFor="payments-currency" hint={t('payments.settings.currencyHint')}>
          <div className="relative">
            <select
              id="payments-currency"
              className={SELECT_CLASS}
              value={currency}
              disabled={updateMutation.isPending}
              aria-describedby="payments-currency-message"
              onChange={(event) => save({ profileCurrency: event.target.value as PaymentCurrency })}
            >
              {Object.values(PaymentCurrency).map((option) => (
                <option key={option} value={option}>
                  {t(`payments.settings.currencyOption.${option}`)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </Field>
      </div>

      <div className="flex items-center gap-4 border-t border-border pt-4.5">
        <div className="flex min-w-0 flex-col gap-0.75">
          <h3 className="text-copy font-semibold text-ink">{t('payments.settings.reminders')}</h3>
          <p className="text-body text-muted-foreground">{t('payments.settings.remindersHint')}</p>
        </div>
        <Link
          to="/automations"
          className="ml-auto flex shrink-0 items-center gap-0.5 rounded-sm text-body font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('payments.settings.openAutomations')}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {bankOpen && (
        <ChangeBankAccountDialog
          open
          onOpenChange={setBankOpen}
          currentIban={settings.iban}
          currentHolder={settings.accountHolder}
          hasPassword={meQuery.data?.hasPassword ?? true}
        />
      )}
    </>
  );
}

/** Settings -> Payments: the bank account behind payment requests, the request defaults and the main currency. */
export default function PaymentsCard() {
  const { t } = useTranslation();
  const settingsQuery = usePaymentSettings();

  if (settingsQuery.isError && isNotEntitled(settingsQuery.error)) {
    return <PaymentsPaywall />;
  }
  // No professional profile (for example an admin-only account): there is nothing to configure.
  if (settingsQuery.isError && getErrorStatus(settingsQuery.error) === 404) {
    return null;
  }

  return (
    <>
      <SettingsCard
        title={t('payments.settings.title')}
        description={t('payments.settings.description')}
        action={
          <span className="inline-flex items-center gap-1.25 rounded-full bg-success-soft px-2 py-0.5 text-meta font-semibold text-success-ink">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {t('payments.settings.badge')}
          </span>
        }
      >
        {settingsQuery.isPending ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : settingsQuery.isError ? (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-body text-error">{t('payments.settings.loadError')}</p>
            <Button type="button" variant="outline" onClick={() => void settingsQuery.refetch()}>
              {t('payments.client.retry')}
            </Button>
          </div>
        ) : (
          <PaymentsBody settings={settingsQuery.data} />
        )}
      </SettingsCard>
      {settingsQuery.isSuccess && <PackagesSummaryCard />}
    </>
  );
}
