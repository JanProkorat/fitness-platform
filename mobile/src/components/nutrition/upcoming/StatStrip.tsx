import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClientOwnPlanItem } from '@/api/generated';
import { formatWhole } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

type Stat = {
  key: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
  value: number | undefined;
  dot?: keyof Colors;
};

const statsOf = (plan: ClientOwnPlanItem): Stat[] => [
  { key: 'kcal', value: plan.avgKcalPerDay },
  { key: 'protein', value: plan.avgProteinPerDay, dot: 'macroProtein' },
  { key: 'carbs', value: plan.avgCarbsPerDay, dot: 'macroCarbs' },
  { key: 'fat', value: plan.avgFatPerDay, dot: 'macroFat' },
  { key: 'fiber', value: plan.avgFiberPerDay, dot: 'macroFiber' },
];

/** True when the plan carries at least one daily average worth showing. */
export const hasAverages = (plan: ClientOwnPlanItem): boolean =>
  statsOf(plan).some((stat) => stat.value !== undefined && stat.value !== null);

/** Daily averages across the whole plan: kcal and the four macros, one centred column each. */
export function StatStrip({ plan }: { plan: ClientOwnPlanItem }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View accessibilityLabel={t('nutritionUpcoming.averages')} style={styles.strip}>
      {statsOf(plan).map(({ key, value, dot }, index) => {
        const whole = value === undefined || value === null ? t('nutritionUpcoming.noValue') : formatWhole(i18n.language, value);
        const shown = key === 'kcal' || whole === t('nutritionUpcoming.noValue') ? whole : t('nutritionMeal.macros.grams', { value: whole });
        const label = key === 'kcal' ? t('nutritionUpcoming.kcalPerDay') : t(`nutritionMeal.macros.${key}`);
        return (
          <View
            key={key}
            accessible
            accessibilityLabel={`${label}, ${shown}`}
            style={[styles.cell, index > 0 ? styles.divided : null]}
          >
            <Text variant="subtitle" numberOfLines={1}>
              {shown}
            </Text>
            <View style={styles.caption}>
              {dot ? <View style={[styles.dot, { backgroundColor: theme.colors[dot] }]} /> : null}
              <Text variant="caption" color="muted" numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      paddingVertical: theme.spacing.md,
      borderTopWidth: theme.sizes.border,
      borderBottomWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    cell: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: theme.spacing.xxs / 2,
    },
    divided: {
      borderLeftWidth: theme.sizes.border,
      borderLeftColor: theme.colors.lineStrong,
    },
    caption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
    dot: {
      width: theme.sizes.statusDot,
      height: theme.sizes.statusDot,
      borderRadius: theme.radii.pill,
    },
  });
