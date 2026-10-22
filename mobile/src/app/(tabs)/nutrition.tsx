import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { TabFade } from '@/components/TabFade';
import { TabPlaceholder } from '@/components/today/TabPlaceholder';
import { useAuthStore } from '@/stores/auth';

export default function NutritionScreen() {
  const { t } = useTranslation();

  return (
    <TabFade>
      <TabPlaceholder title={t('tabs.nutrition')} body={t('placeholder.nutrition')}>
        <Button
          label={t('common.signOut')}
          variant="destructive"
          onPress={() => void useAuthStore.getState().logout()}
        />
      </TabPlaceholder>
    </TabFade>
  );
}
