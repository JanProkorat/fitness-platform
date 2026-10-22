import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ClientPaymentHistoryEntryDto } from '@/api/client-payments';
import { formatMoney } from '@/lib/money';
import { formatHistoryPeriod, formatInstantDay } from '@/lib/payment-format';

const ACTIONS = [
  'SetClientPaymentTerms',
  'AddClientOneOffPayment',
  'MarkClientPaymentPaid',
  'WaiveClientPayment',
  'RequestClientPayment',
] as const;

type KnownAction = (typeof ACTIONS)[number];

function isKnownAction(action: string | undefined): action is KnownAction {
  return ACTIONS.some((known) => known === action);
}

/** One line of the history: what the coach did, in the coach's words. */
function describeEntry(t: TFunction, entry: ClientPaymentHistoryEntryDto, language: string): string {
  const period = formatHistoryPeriod(entry.period, language);
  // Older entries and waive entries carry no currency; an amount without one is left out, not guessed.
  const amount =
    entry.amount !== undefined && entry.currency !== undefined
      ? formatMoney(entry.amount, entry.currency, language)
      : '';
  if (!isKnownAction(entry.action)) {
    return t('payments.client.history.unknown');
  }
  switch (entry.action) {
    case 'SetClientPaymentTerms':
      return t('payments.client.history.terms', {
        package: entry.detail ?? '',
        discount: entry.discount ? ` · ${entry.discount}` : '',
      });
    case 'AddClientOneOffPayment':
      return t('payments.client.history.oneOff', { title: period, amount: amount ? ` · ${amount}` : '' });
    case 'MarkClientPaymentPaid':
      return t('payments.client.history.paid', { period });
    case 'WaiveClientPayment':
      return entry.detail
        ? t('payments.client.history.waivedReason', { period, reason: entry.detail })
        : t('payments.client.history.waived', { period });
    case 'RequestClientPayment':
      return t('payments.client.history.requested', { period, amount: amount ? ` · ${amount}` : '' });
  }
}

interface Props {
  entries: readonly ClientPaymentHistoryEntryDto[];
}

/** "Change history": the coach's own recent payment actions for this client, newest first. */
export default function ChangeHistoryCard({ entries }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  return (
    <section
      aria-label={t('payments.client.history.title')}
      className="flex flex-col gap-3.5 rounded-2xl border border-line bg-card p-5 shadow-panel"
    >
      <div className="flex items-center gap-2.5">
        <h3 className="text-copy font-semibold text-ink">{t('payments.client.history.title')}</h3>
        <span className="ml-auto text-meta text-muted-foreground">{t('payments.client.history.onlyYou')}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-body text-muted-foreground">{t('payments.client.history.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2.25 text-body text-ink-2">
          {entries.slice(0, 10).map((entry, index) => (
            <li key={`${entry.occurredAt ?? ''}-${index}`} className="flex gap-2.5">
              <span className="w-14 shrink-0 text-muted-foreground">{formatInstantDay(entry.occurredAt, language)}</span>
              <span className="min-w-0 break-words">{describeEntry(t, entry, language)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
