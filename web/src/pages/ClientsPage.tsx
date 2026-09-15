import { useTranslation } from 'react-i18next';
import PagePlaceholder from '@/components/layout/PagePlaceholder';

/** Real implementation lands in epic sub-issue 3 (design spec §5). */
export default function ClientsPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t('sidebar.clients')} body={t('shell.comingSoon')} />;
}
