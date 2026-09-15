import { useTranslation } from 'react-i18next';
import PagePlaceholder from '@/components/layout/PagePlaceholder';

/** Real implementation lands in epic sub-issue 6 (design spec §5). */
export default function IngredientsPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t('sidebar.ingredients')} body={t('shell.comingSoon')} />;
}
