import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatRange, isoDay } from '@/components/nutrition/plan/model';
import type { RecipeGroup } from '@/components/nutrition/recipes/model';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Plan header above its recipes: name, nutritionist, dates (or "now") and how many recipes. */
export function RecipeGroupHeader({ group }: { group: RecipeGroup }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme, group.isCurrentPlan);
  const start = isoDay(group.startDate);
  const end = isoDay(group.endDate);
  const when = group.isCurrentPlan
    ? t('nutritionRecipes.now')
    : start && end
      ? formatRange(i18n.language, start, end)
      : undefined;
  const meta = [group.nutritionistName, when, String(group.items.length)].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <View style={styles.bar} />
      <Text variant="bodyStrong" numberOfLines={1} style={styles.name}>
        {group.planName}
      </Text>
      <Text variant="caption" color="muted" numberOfLines={1} style={styles.meta}>
        {meta}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme, current: boolean) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.xl,
    },
    bar: {
      width: theme.sizes.recipeGroupBar,
      height: theme.sizes.recipeGroupBarHeight,
      borderRadius: theme.radii.pill,
      backgroundColor: current ? theme.colors.nutrition : theme.colors.stepRing,
    },
    name: {
      flexShrink: 1,
    },
    meta: {
      flex: 1,
    },
  });
