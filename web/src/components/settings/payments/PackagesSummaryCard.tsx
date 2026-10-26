import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import SettingsCard from '@/components/settings/SettingsCard';
import { usePaymentDiscounts, usePaymentPackages } from '@/hooks/useClientPaymentQueries';

/** "Packages and discounts": how many there are, with a way to the Packages page. */
export default function PackagesSummaryCard() {
  const { t } = useTranslation();
  const packagesQuery = usePaymentPackages(true);
  const discountsQuery = usePaymentDiscounts(true);

  const description =
    packagesQuery.isSuccess && discountsQuery.isSuccess
      ? t('payments.settings.packages.counts', {
          packages: packagesQuery.data.length,
          discounts: discountsQuery.data.length,
        })
      : t('payments.settings.packages.description');

  return (
    <SettingsCard
      title={t('payments.settings.packages.title')}
      description={description}
      action={
        <Link
          to="/packages"
          className="flex items-center gap-0.5 rounded-sm text-body font-semibold text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t('payments.settings.packages.open')}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      }
    >
      {null}
    </SettingsCard>
  );
}
