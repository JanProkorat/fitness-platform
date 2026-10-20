import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { TabPlaceholder } from '@/components/today/TabPlaceholder';
import { useAuthStore } from '@/stores/auth';

export default function TrainingScreen() {
  const { t } = useTranslation();

  return (
    <TabPlaceholder title={t('tabs.training')} body={t('placeholder.training')}>
      <Button
        label={t('common.signOut')}
        variant="destructive"
        onPress={() => void useAuthStore.getState().logout()}
      />
    </TabPlaceholder>
  );
}
