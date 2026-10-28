import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import type { GlobalNutritionSettings } from '@/api/generated';
import { formatWhole } from '@/components/nutrition/meal/format';
import type { Macros } from '@/components/nutrition/meal/format';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Colors, Theme } from '@/theme';

type MacroKey = 'protein' | 'carbs' | 'fat' | 'fiber';

const BARS: { key: MacroKey; color: keyof Colors; target: keyof GlobalNutritionSettings }[] = [
  { key: 'protein', color: 'macroProtein', target: 'proteinGrams' },
  { key: 'carbs', color: 'macroCarbs', target: 'carbsGrams' },
  { key: 'fat', color: 'macroFat', target: 'fatGrams' },
  { key: 'fiber', color: 'macroFiber', target: 'fiberGrams' },
];

const ratio = (value: number, target: number | undefined): number =>
  target && target > 0 ? Math.min(Math.max(value / target, 0), 1) : 0;

type DaySummaryProps = {
  /** Totals of the meals eaten on the selected day. */
  eaten: Macros;
  targets: GlobalNutritionSettings | undefined;
};

/** Energy ring and macro bars for one day: what was eaten against the plan's daily targets. */
export function DaySummary({ eaten, targets }: DaySummaryProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;

  const size = theme.sizes.summaryRing;
  const stroke = theme.sizes.summaryRingStroke;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const kcalTarget = targets?.dailyKcal;
  const filled = ratio(eaten.kcal, kcalTarget) * circumference;

  return (
    <Card style={styles.card}>
      <View
        style={styles.ring}
        accessible
        accessibilityLabel={
          kcalTarget
            ? t('nutritionPlan.summary.ringOf', {
                value: formatWhole(language, eaten.kcal),
                target: formatWhole(language, kcalTarget),
              })
            : t('nutritionPlan.summary.ringValue', { value: formatWhole(language, eaten.kcal) })
        }
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.colors.lineStrong}
            strokeWidth={stroke}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={theme.colors.nutrition}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.ringLabel}>
          <Text variant="barTitle">{formatWhole(language, eaten.kcal)}</Text>
          {kcalTarget ? (
            <Text variant="micro" color="muted">
              {t('nutritionPlan.summary.ofKcal', { target: formatWhole(language, kcalTarget) })}
            </Text>
          ) : (
            <Text variant="micro" color="muted">
              {t('nutritionPlan.summary.kcal')}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.bars}>
        {BARS.map(({ key, color, target }) => {
          const goal = targets?.[target];
          return (
            <View key={key} style={styles.bar}>
              <View style={styles.barHead}>
                <View style={styles.barName}>
                  <View style={[styles.dot, { backgroundColor: theme.colors[color] }]} />
                  <Text variant="label" color="muted">
                    {t(`nutritionMeal.macros.${key}`)}
                  </Text>
                </View>
                <Text variant="labelStrong">
                  {formatWhole(language, eaten[key])}
                  <Text variant="label" color="muted">
                    {goal
                      ? t('nutritionPlan.summary.ofGrams', { target: formatWhole(language, goal) })
                      : t('nutritionPlan.summary.grams')}
                  </Text>
                </Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { backgroundColor: theme.colors[color], width: `${Math.round(ratio(eaten[key], goal) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.cardInset,
      padding: theme.spacing.cardInset,
    },
    ring: {
      width: theme.sizes.summaryRing,
      height: theme.sizes.summaryRing,
      flexShrink: 0,
    },
    ringLabel: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bars: {
      flex: 1,
      gap: theme.spacing.md,
    },
    bar: {
      gap: theme.spacing.snug,
    },
    barHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    barName: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
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
