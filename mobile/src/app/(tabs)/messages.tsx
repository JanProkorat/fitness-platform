import { useTranslation } from 'react-i18next';

import { TabPlaceholder } from '@/components/today/TabPlaceholder';

export default function MessagesScreen() {
  const { t } = useTranslation();

  return <TabPlaceholder title={t('tabs.messages')} body={t('placeholder.messages')} />;
}
