import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { NutritionEmpty } from '@/components/nutrition/tab/NutritionEmpty';
import { NutritionPlanView, isMissingPlan } from '@/components/nutrition/tab/NutritionPlanView';
import { NutritionWaiting } from '@/components/nutrition/tab/NutritionWaiting';
import { TabHeader } from '@/components/nutrition/tab/TabHeader';
import { Screen } from '@/components/Screen';
import { TabFade } from '@/components/TabFade';
import { Text } from '@/components/Text';
import { coveredCollaborations } from '@/components/today/collaborationRoles';
import { useCollaborations } from '@/hooks/useCollaborations';
import { useNutritionWeekPlan } from '@/hooks/useNutritionWeekPlan';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export default function NutritionScreen() {
  return (
    <TabFade>
      <NutritionContent />
    </TabFade>
  );
}

function NutritionContent() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const collaborations = useCollaborations();
  const weekPlan = useNutritionWeekPlan();
  const { refreshing, onRefresh } = usePullToRefresh();
  const barClearance = theme.sizes.tabBar + theme.sizes.tabBarBottom + theme.spacing.xxl;

  const screen = (content: ReactNode, withShortcuts = false) => (
    <Screen
      scroll
      collapseTabBar
      header={<TabHeader withShortcuts={withShortcuts} />}
      topGap={theme.spacing.safeAreaGap}
      bottomInset={barClearance}
      contentStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.muted}
          colors={[theme.colors.muted]}
        />
      }
    >
      {content}
    </Screen>
  );

  if (weekPlan.data) {
    return screen(<NutritionPlanView week={weekPlan.data} />, true);
  }

  if (weekPlan.isPending || (weekPlan.isError && isMissingPlan(weekPlan.error) && collaborations.isPending)) {
    return screen(
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>,
    );
  }

  if (weekPlan.isError && !isMissingPlan(weekPlan.error)) {
    return screen(
      <View style={styles.center}>
        <Text variant="heading" accessibilityRole="header" style={styles.centered}>
          {t('nutritionTab.error.title')}
        </Text>
        <Text variant="body" color="muted" style={styles.centered}>
          {t('nutritionTab.error.body')}
        </Text>
        <Button label={t('nutritionTab.retry')} onPress={() => void weekPlan.refetch()} />
      </View>,
    );
  }

  // No published plan: a linked nutritionist is still building it, otherwise offer to find one.
  const covering = collaborations.isError ? [] : coveredCollaborations(collaborations.data ?? []);
  const nutritionist = covering.find((entry) => entry.roles.includes('Nutritionist'));
  if (nutritionist) {
    return screen(
      <NutritionWaiting collaboration={nutritionist.collaboration} onlyCollaboration={covering.length === 1} />,
    );
  }
  return screen(<NutritionEmpty />);
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
    },
    center: {
      gap: theme.spacing.xl,
      paddingVertical: theme.spacing.huge,
    },
    centered: {
      textAlign: 'center',
    },
  });
