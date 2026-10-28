import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { formatWhole } from '@/components/nutrition/meal/format';
import { weekdayInitial, weekdayName } from '@/components/nutrition/plan/model';
import { averageKcal, barScale, weekBars } from '@/components/nutrition/week/model';
import type { WeekDay } from '@/components/nutrition/plan/model';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type WeekGlanceProps = {
  days: WeekDay[];
  selected: string;
  today: string;
  /** The plan's daily kcal target; the dashed line is left out without it. */
  target: number | undefined;
  onSelect: (date: string) => void;
};

/** "This week": one bar of planned kcal per day, the daily target as a dashed line, the day average in the header. */
export function WeekGlance({ days, selected, today, target, onSelect }: WeekGlanceProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const language = i18n.language;

  const targetKcal = target !== undefined && target > 0 ? target : undefined;
  const bars = weekBars(days);
  const average = averageKcal(bars);
  const scale = barScale(bars, targetKcal);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text variant="barTitle" accessibilityRole="header">
          {t('nutritionPlan.week.glance.title')}
        </Text>
        {average !== undefined ? (
          <Text variant="caption" color="muted">
            {t('nutritionPlan.week.glance.average', { value: formatWhole(language, average) })}
          </Text>
        ) : null}
      </View>

      <View style={styles.chart}>
        {targetKcal !== undefined ? (
          <View style={styles.plot} pointerEvents="none">
            <View style={[styles.targetLine, { bottom: `${(targetKcal / scale) * 100}%` }]}>
              <View style={styles.targetDash} />
            </View>
          </View>
        ) : null}
        {bars.map(({ date, kcal }) => {
          const isSelected = date === selected;
          const isToday = date === today;
          const name = weekdayName(language, date);
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={t('nutritionPlan.week.glance.bar', {
                day: isToday ? t('nutritionPlan.week.todayLabel', { day: name }) : name,
                value: formatWhole(language, kcal),
              })}
              onPress={() => onSelect(date)}
              style={styles.column}
            >
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    { height: `${(kcal / scale) * 100}%` },
                    isSelected && styles.barSelected,
                    isToday && styles.barToday,
                  ]}
                />
              </View>
              <Text
                variant={isSelected || isToday ? 'labelStrong' : 'label'}
                color={isToday ? 'nutritionInk' : isSelected ? 'ink' : 'muted'}
                style={styles.initial}
              >
                {weekdayInitial(language, date)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {targetKcal !== undefined ? (
        <View style={styles.legend}>
          <View style={styles.legendDash} />
          <Text variant="label" color="muted">
            {t('nutritionPlan.week.glance.target', { value: formatWhole(language, targetKcal) })}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: theme.spacing.cardInset,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    chart: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    column: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    barArea: {
      height: theme.sizes.weekBars,
      justifyContent: 'flex-end',
    },
    bar: {
      minHeight: theme.sizes.weekBarMin,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.colors.stepLine,
    },
    barSelected: {
      backgroundColor: theme.colors.nutrition,
    },
    barToday: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.nutritionInk,
    },
    initial: {
      textAlign: 'center',
    },
    // Covers the bar area only, so the line's percentage is measured against the bars and not the initials below them.
    plot: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: theme.sizes.weekBars,
    },
    targetLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: theme.sizes.border,
      overflow: 'hidden',
    },
    targetDash: {
      height: theme.sizes.border * 2,
      borderWidth: theme.sizes.border,
      borderStyle: 'dashed',
      borderColor: theme.colors.stepRing,
      borderRadius: theme.sizes.border,
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    legendDash: {
      width: theme.sizes.weekTargetDash,
      height: theme.sizes.border,
      borderTopWidth: theme.sizes.border,
      borderStyle: 'dashed',
      borderColor: theme.colors.stepRing,
    },
  });
