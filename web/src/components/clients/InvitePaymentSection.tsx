import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { DiscountDuration, PaymentCurrency, type CoachDiscountDto, type CoachPackageDto } from '@/api/client-payments';
import {
  billingSuffix,
  discountFitsPackage,
  discountValueLabel,
  previewDiscountAmount,
} from '@/components/client-detail/payment/paymentModel';
import { formatMoney } from '@/lib/money';

const SELECT_CLASS =
  'h-10 w-full min-w-0 appearance-none rounded-field border border-input bg-background pr-9 pl-3 text-body text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50';

interface Props {
  packages: CoachPackageDto[];
  discounts: CoachDiscountDto[];
  /** The chosen package id, or '' for none. */
  packageId: string;
  /** The chosen discount id, or '' for none. */
  discountId: string;
  onPackageChange: (packageId: string) => void;
  onDiscountChange: (discountId: string) => void;
}

function Chevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden="true"
    />
  );
}

/** Package and discount pickers of the invite drawer, with the resulting price per period. */
export default function InvitePaymentSection({
  packages,
  discounts,
  packageId,
  discountId,
  onPackageChange,
  onDiscountChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  if (packages.length === 0) {
    return (
      <p className="text-body text-muted-foreground">
        {t('clients.addClientDrawer.payment.noPackages')}{' '}
        <Link to="/packages" className="font-semibold text-foreground underline underline-offset-2">
          {t('clients.addClientDrawer.payment.createPackage')}
        </Link>
      </p>
    );
  }

  const selectedPackage = packages.find((option) => option.packageId === packageId);
  const discountOptions = discounts.filter((discount) => discountFitsPackage(discount, selectedPackage));
  const selectedDiscount = discountOptions.find((discount) => discount.discountId === discountId);

  const basePrice = selectedPackage?.price ?? 0;
  const payable = Math.max(0, basePrice - previewDiscountAmount(selectedDiscount, basePrice));
  const currency = selectedPackage?.currency ?? PaymentCurrency.CZK;
  const suffix = billingSuffix(t, selectedPackage?.billing, selectedPackage?.intervalWeeks);
  const firstPayments =
    selectedDiscount?.duration === DiscountDuration.FirstPayments ? selectedDiscount.durationPayments : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="add-client-package">{t('clients.addClientDrawer.payment.package')}</Label>
          <div className="relative">
            <select
              id="add-client-package"
              className={SELECT_CLASS}
              value={selectedPackage?.packageId ?? ''}
              onChange={(event) => onPackageChange(event.target.value)}
            >
              <option value="">{t('clients.addClientDrawer.payment.packagePlaceholder')}</option>
              {packages.map((option) => (
                <option key={option.packageId} value={option.packageId}>
                  {option.name} · {formatMoney(option.price ?? 0, option.currency ?? PaymentCurrency.CZK, language)}{' '}
                  {billingSuffix(t, option.billing, option.intervalWeeks)}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="add-client-discount">{t('clients.addClientDrawer.payment.discount')}</Label>
          <div className="relative">
            <select
              id="add-client-discount"
              className={SELECT_CLASS}
              disabled={!selectedPackage}
              value={selectedDiscount?.discountId ?? ''}
              onChange={(event) => onDiscountChange(event.target.value)}
            >
              <option value="">
                {!selectedPackage
                  ? t('clients.addClientDrawer.payment.discountNeedsPackage')
                  : discountOptions.length === 0
                    ? t('clients.addClientDrawer.payment.noDiscounts')
                    : t('clients.addClientDrawer.payment.discountPlaceholder')}
              </option>
              {discountOptions.map((discount) => (
                <option key={discount.discountId} value={discount.discountId}>
                  {discount.name} {discountValueLabel(discount.type, discount.value, discount.currency, language)}
                </option>
              ))}
            </select>
            <Chevron />
          </div>
        </div>
      </div>

      {selectedPackage && (
        <div
          className="flex items-center gap-2 rounded-field bg-sunken px-3 py-2.5 text-body"
          data-testid="invite-payable"
        >
          <span className="text-muted-foreground">{t('clients.addClientDrawer.payment.pays')}</span>
          <span className="ml-auto text-right font-semibold text-foreground">
            {firstPayments != null
              ? t('payments.client.terms.paysFirstPayments', {
                  count: firstPayments,
                  amount: formatMoney(payable, currency, language),
                  full: formatMoney(basePrice, currency, language),
                  suffix,
                })
              : `${formatMoney(payable, currency, language)} ${suffix}`}
          </span>
        </div>
      )}

      <span className="text-meta text-muted-foreground">{t('clients.addClientDrawer.payment.helper')}</span>
    </div>
  );
}
