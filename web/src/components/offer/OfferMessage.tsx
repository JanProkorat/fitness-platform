import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { OFFER_MESSAGE_MAX_LENGTH } from '@/components/offer/offerModel';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** First name of the client, for "Message to Adam" and the placeholder; generic copy when unknown. */
  clientName?: string;
}

/** "Message to Adam · optional": a textarea with the "0 / 500" counter. */
export default function OfferMessage({ value, onChange, clientName }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const tooLong = value.length > OFFER_MESSAGE_MAX_LENGTH;

  return (
    <section className="flex flex-col gap-2.5" data-testid="offer-message">
      <h3 className="flex items-baseline gap-2 text-label font-bold tracking-label text-muted-foreground uppercase">
        <label htmlFor={id}>
          {clientName ? t('offer.message.title', { name: clientName }) : t('offer.message.titleGeneric')}
        </label>
        <span className="text-meta font-normal tracking-normal normal-case">{t('offer.optional')}</span>
      </h3>
      <Textarea
        id={id}
        rows={3}
        value={value}
        placeholder={
          clientName ? t('offer.message.placeholder', { name: clientName }) : t('offer.message.placeholderGeneric')
        }
        aria-invalid={tooLong}
        className="min-h-24 resize-none"
        onChange={(event) => onChange(event.target.value)}
      />
      {tooLong && <p className="text-meta text-destructive">{t('offer.message.tooLong', { max: OFFER_MESSAGE_MAX_LENGTH })}</p>}
      <span
        aria-live="polite"
        className={cn('self-end text-meta', tooLong ? 'text-destructive' : 'text-muted-foreground')}
      >
        {`${value.length} / ${OFFER_MESSAGE_MAX_LENGTH}`}
      </span>
    </section>
  );
}
