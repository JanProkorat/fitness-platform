import { useTranslation } from 'react-i18next';
import { billingSuffix } from '@/components/client-detail/payment/paymentModel';
import { billingDescription, type OfferPackage } from '@/components/offer/offerModel';
import { formatMoney } from '@/lib/money';

interface Props {
  pkg: OfferPackage;
  /** Small green badge beside the name, e.g. "Adam's choice". */
  badge?: string;
}

/** One package shown as a wide, selected card: the package a client already chose, or a proposal that waits. */
export default function ChosenPackageCard({ pkg, badge }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <div
      data-testid="offer-chosen-package"
      className="flex items-center gap-3 rounded-field border border-success bg-card px-3.5 py-3"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-body font-semibold text-ink">{pkg.name}</span>
          {badge && (
            <span className="rounded-full bg-success-soft px-2 py-0.5 text-meta font-semibold text-success-ink">{badge}</span>
          )}
        </span>
        <span className="text-meta text-muted-foreground">{billingDescription(t, pkg.billing, pkg.intervalWeeks)}</span>
      </div>
      <span className="shrink-0 text-right">
        <span className="font-display text-card-title font-semibold text-ink">
          {formatMoney(pkg.price, pkg.currency, i18n.language)}
        </span>{' '}
        <span className="text-meta text-muted-foreground">{billingSuffix(t, pkg.billing, pkg.intervalWeeks)}</span>
      </span>
    </div>
  );
}
