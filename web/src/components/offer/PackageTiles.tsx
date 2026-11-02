import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { billingSuffix } from '@/components/client-detail/payment/paymentModel';
import type { OfferPackage } from '@/components/offer/offerModel';
import { formatMoney } from '@/lib/money';

/** The id the "No package" tile selects. */
export const NO_PACKAGE_ID = '';

interface Props {
  packages: OfferPackage[];
  /** The chosen package id, or `NO_PACKAGE_ID`. */
  selectedId: string;
  onSelect: (packageId: string) => void;
  /** Shows the trailing "No package / Decide later" tile. */
  allowNone?: boolean;
}

const TILE_CLASS =
  'flex min-h-28 flex-col items-start gap-1 rounded-field border bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** The coach's packages as selectable tiles, with an optional "No package" tile at the end. */
export default function PackageTiles({ packages, selectedId, onSelect, allowNone = false }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t('offer.package')}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      data-testid="offer-package-tiles"
    >
      {packages.map((pkg) => {
        const isSelected = pkg.id === selectedId;
        return (
          <button
            key={pkg.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(pkg.id)}
            className={cn(TILE_CLASS, 'relative', isSelected ? 'border-success bg-success-soft' : 'border-border hover:bg-muted')}
          >
            {isSelected && (
              <span className="absolute top-2.5 right-2.5 flex size-4.5 items-center justify-center rounded-full bg-success text-card">
                <Check className="size-3" aria-hidden="true" />
              </span>
            )}
            <span className="pr-5 text-body font-semibold text-ink">{pkg.name}</span>
            <span className="mt-auto font-display text-card-title font-semibold text-ink">
              {formatMoney(pkg.price, pkg.currency, i18n.language)}
            </span>
            <span className="text-meta text-muted-foreground">{billingSuffix(t, pkg.billing, pkg.intervalWeeks)}</span>
          </button>
        );
      })}
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={selectedId === NO_PACKAGE_ID}
          onClick={() => onSelect(NO_PACKAGE_ID)}
          className={cn(
            TILE_CLASS,
            'relative',
            selectedId === NO_PACKAGE_ID ? 'border-success bg-success-soft' : 'border-border hover:bg-muted',
          )}
        >
          {selectedId === NO_PACKAGE_ID && (
            <span className="absolute top-2.5 right-2.5 flex size-4.5 items-center justify-center rounded-full bg-success text-card">
              <Check className="size-3" aria-hidden="true" />
            </span>
          )}
          <span className="pr-5 text-body font-semibold text-ink">{t('offer.noPackage')}</span>
          <span className="mt-auto text-meta text-muted-foreground">{t('offer.decideLater')}</span>
        </button>
      )}
    </div>
  );
}
