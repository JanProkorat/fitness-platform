import { useTranslation } from 'react-i18next';
import PagePlaceholder from '@/components/layout/PagePlaceholder';

/** Real implementation lands in epic sub-issue 7 (design spec §5). */
export default function RecipesPage() {
  const { t } = useTranslation();
  return <PagePlaceholder title={t('sidebar.recipes')} body={t('shell.comingSoon')} />;
}
