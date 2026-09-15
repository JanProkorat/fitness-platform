import { useTranslation } from 'react-i18next';
import PagePlaceholder from '@/components/layout/PagePlaceholder';

/** Real implementation lands in epic sub-issue 5 (design spec §5). */
export default function InboxPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t('sidebar.inbox')} body={t('shell.comingSoon')} />;
}
