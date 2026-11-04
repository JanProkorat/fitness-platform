import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DiscountDuration, type CoachDiscountDto } from '@/api/client-payments';
import { discountValueLabel } from '@/components/client-detail/payment/paymentModel';
import { discountBlock, usableDiscounts, type OfferPackage } from '@/components/offer/offerModel';

interface Props {
  discounts: CoachDiscountDto[];
  /** The package the discount would apply to; the picker is disabled without one. */
  pkg: OfferPackage | undefined;
  /** The chosen discount id, or '' for none. */
  value: string;
  onChange: (discountId: string) => void;
}

/** "Every payment", "First payment only" or "First 3 payments". */
function durationLabel(t: ReturnType<typeof useTranslation>['t'], discount: CoachDiscountDto): string {
  if (discount.duration !== DiscountDuration.FirstPayments) {
    return t('offer.discount.duration.every');
  }
  return (discount.durationPayments ?? 1) === 1
    ? t('offer.discount.duration.firstOne')
    : t('offer.discount.duration.firstMany', { count: discount.durationPayments });
}

/**
 * "+ Add discount" for an offer: collapsed it is a button (or the chosen discount as a chip), opened it lists the
 * coach's usable discounts as radio rows. Discounts that do not fit the package stay listed, disabled, with the reason.
 */
export default function DiscountPicker({ discounts, pkg, value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const language = i18n.language;
  const options = usableDiscounts(discounts);
  const chosen = options.find((discount) => discount.discountId === value);

  if (!open) {
    if (chosen) {
      return (
        <span
          data-testid="offer-discount-chip"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-success bg-success-soft py-1 pr-1.5 pl-3 text-body font-semibold text-success-ink"
        >
          {chosen.name} {discountValueLabel(chosen.type, chosen.value, chosen.currency, language)}
          <button
            type="button"
            aria-label={t('offer.discount.remove')}
            onClick={() => onChange('')}
            className="flex size-5 items-center justify-center rounded-full outline-none hover:bg-success/15 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={!pkg}
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-2 rounded-field px-1 py-1 text-body font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('offer.discount.add')}
      </button>
    );
  }

  return (
    <div data-testid="offer-discount-panel" className="overflow-hidden rounded-field border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <span className="text-body font-semibold text-ink">{t('offer.discount.title')}</span>
        <span className="min-w-0 truncate text-meta text-muted-foreground">
          {t('offer.discount.forPackage', { name: pkg?.name ?? '' })}
        </span>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => setOpen(false)}
          className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div role="radiogroup" aria-label={t('offer.discount.title')} className="flex flex-col">
        {options.length === 0 && <p className="px-3.5 py-3 text-body text-muted-foreground">{t('offer.discount.none')}</p>}
        {options.map((discount) => {
          const block = discountBlock(discount, pkg);
          const isSelected = discount.discountId === value;
          const subline = block
            ? t(`offer.discount.reason.${block}`, { currency: discount.currency })
            : durationLabel(t, discount);
          return (
            <button
              key={discount.discountId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={block !== null}
              onClick={() => {
                onChange(discount.discountId ?? '');
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-3 border-b border-border px-3.5 py-2.5 text-left outline-none last:border-b-0 focus-visible:bg-muted',
                isSelected && 'bg-success-soft',
                block ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4.5 shrink-0 items-center justify-center rounded-full border',
                  isSelected ? 'border-success' : block ? 'border-dashed border-border' : 'border-input',
                )}
              >
                {isSelected && <span className="size-2 rounded-full bg-success" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-semibold text-ink">{discount.name}</span>
                <span className="text-meta text-muted-foreground">{subline}</span>
              </span>
              <span className="shrink-0 text-body font-semibold text-ink">
                {discountValueLabel(discount.type, discount.value, discount.currency, language)}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border px-3.5 py-2.5">
        <Link
          to="/packages"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-body font-semibold text-ink hover:underline"
        >
          {t('offer.discount.manage')}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
