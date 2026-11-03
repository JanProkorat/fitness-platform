import { useTranslation } from 'react-i18next';
import { billingSuffix } from '@/components/client-detail/payment/paymentModel';
import type { OfferPackage, OfferPrice } from '@/components/offer/offerModel';
import { formatMoney } from '@/lib/money';

interface Props {
  pkg: OfferPackage;
  price: OfferPrice;
  /** First name of the client, for "Adam pays"; generic copy when unknown. */
  clientName?: string;
}

/** The footer's right-aligned "Adam pays 1 800 Kč / month" block; with a discount it strikes the full price. */
export default function OfferPayable({ pkg, price, clientName }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const suffix = billingSuffix(t, pkg.billing, pkg.intervalWeeks);
  const hasDiscount = price.payable < price.base;
  const full = formatMoney(price.base, price.currency, language);
  const payable = formatMoney(price.payable, price.currency, language);

  return (
    <div data-testid="offer-payable" className="flex flex-col items-end leading-tight">
      <span className="text-meta text-muted-foreground">{clientName ? t('offer.pays', { name: clientName }) : t('offer.paysGeneric')}</span>
      {price.firstPayments != null && hasDiscount ? (
        <>
          <span className="text-body font-semibold text-ink">
            <s className="mr-1.5 font-normal text-muted-foreground">{full}</s>
            {t('offer.paysFirst', { count: price.firstPayments, amount: payable })}
          </span>
          <span className="text-meta text-muted-foreground">{t('offer.paysThen', { amount: full, suffix })}</span>
        </>
      ) : (
        <span className="text-body font-semibold text-ink">
          {hasDiscount && <s className="mr-1.5 font-normal text-muted-foreground">{full}</s>}
          {`${payable} ${suffix}`}
        </span>
      )}
    </div>
  );
}
