import { useTranslation } from 'react-i18next';
import FeaturePaywall from '@/components/paywall/FeaturePaywall';

/**
 * The calm "not on your plan" state for a coach whose subscription does not include payments.
 * Names no plan and no price. Shared by the client Payment tab and Settings -> Payments.
 */
export default function PaymentsPaywall() {
  const { t } = useTranslation();
  return (
    <FeaturePaywall
      badge={t('packages.paywall.badge')}
      title={t('packages.paywall.title')}
      description={t('packages.paywall.description')}
      bullets={[t('packages.paywall.bullet1'), t('packages.paywall.bullet2'), t('packages.paywall.bullet3')]}
    />
  );
}
