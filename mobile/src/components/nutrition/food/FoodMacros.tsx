import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/nutrition/meal/DetailCard';
import { formatAmount, formatWhole } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

type MacroKey = 'protein' | 'carbs' | 'fat' | 'fiber';

const ROWS: { key: MacroKey; color: keyof Colors }[] = [
  { key: 'protein', color: 'macroProtein' },
  { key: 'carbs', color: 'macroCarbs' },
  { key: 'fat', color: 'macroFat' },
  { key: 'fiber', color: 'macroFiber' },
];

/** Grams of a macro that fill its bar; the bars compare foods, not a daily target. */
const BAR_FULL_GRAMS = 30;

type FoodMacrosProps = { per100: Macros };

/** Energy and macros of a food per 100 g. */
export function FoodMacros({ per100 }: FoodMacrosProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;

  return (
    <DetailCard>
      <View style={styles.head}>
        <Text variant="subtitle">{t('nutritionFood.per100')}</Text>
        <Text variant="body" color="muted">
          <Text variant="display">{formatWhole(language, per100.kcal)}</Text>
          {` ${t('nutritionMeal.macros.kcal')}`}
        </Text>
      </View>
      {ROWS.map(({ key, color }, index) => (
        <View key={key} style={[styles.row, index > 0 && styles.divider]}>
          <View style={styles.rowHead}>
            <View style={styles.name}>
              <View style={[styles.dot, { backgroundColor: theme.colors[color] }]} />
              <Text variant="body" color="muted">
                {t(`nutritionMeal.macros.${key}`)}
              </Text>
            </View>
            <Text variant="bodyStrong">
              {t('nutritionMeal.macros.grams', { value: formatAmount(language, per100[key]) })}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: theme.colors[color],
                  width: `${Math.round(Math.min(Math.max(per100[key] / BAR_FULL_GRAMS, 0), 1) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </DetailCard>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    head: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.xs,
    },
    row: {
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.md,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.line,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    name: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    dot: {
      width: theme.sizes.macroDot,
      height: theme.sizes.macroDot,
      borderRadius: theme.radii.pill,
    },
    track: {
      height: theme.sizes.macroBar,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.lineStrong,
      overflow: 'hidden',
    },
    fill: {
      height: theme.sizes.macroBar,
      borderRadius: theme.radii.pill,
    },
  });
