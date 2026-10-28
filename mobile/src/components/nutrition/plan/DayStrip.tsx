import { Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { dayOfMonth, weekdayInitial, weekdayName } from '@/components/nutrition/plan/model';
import type { WeekDay } from '@/components/nutrition/plan/model';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type DayStripProps = {
  days: WeekDay[];
  selected: string;
  today: string;
  /** Arrows are disabled while there is no published week in that direction. */
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  /** Leaves the week arrows out, for a strip that only ever shows one week. */
  hideWeekArrows?: boolean;
  onSelect: (date: string) => void;
};

/** The seven days of a week with arrows to the neighbouring weeks; the selected day gets a green chip. */
export function DayStrip({
  days,
  selected,
  today,
  onPreviousWeek,
  onNextWeek,
  hideWeekArrows = false,
  onSelect,
}: DayStripProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme, hideWeekArrows);
  const tint = theme.scheme === 'dark' ? 'systemThinMaterialDark' : 'systemThinMaterialLight';

  return (
    <View style={styles.shadow}>
      <BlurView intensity={theme.glass.control.intensity} tint={tint} style={styles.blur}>
        {hideWeekArrows ? null : (
          <Arrow
            symbol="chevron.left"
            label={t('nutritionPlan.week.previous')}
            onPress={onPreviousWeek}
            styles={styles}
          />
        )}
        <View style={styles.days}>
          {days.map(({ date }) => {
            const isSelected = date === selected;
            const isToday = date === today;
            const name = weekdayName(i18n.language, date);
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={isToday ? t('nutritionPlan.week.todayLabel', { day: name }) : name}
                onPress={() => onSelect(date)}
                style={styles.day}
              >
                <Text
                  variant={isToday ? 'captionStrong' : 'caption'}
                  color={isToday ? 'nutritionInk' : 'muted'}
                  style={styles.initial}
                >
                  {weekdayInitial(i18n.language, date)}
                </Text>
                <View style={[styles.chip, isSelected && styles.chipSelected]}>
                  <Text
                    variant={isSelected || isToday ? 'bodyStrong' : 'bodySmall'}
                    color={isSelected ? 'onNutrition' : isToday ? 'nutritionInk' : 'ink'}
                  >
                    {dayOfMonth(date)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {hideWeekArrows ? null : (
          <Arrow
            symbol="chevron.right"
            label={t('nutritionPlan.week.next')}
            onPress={onNextWeek}
            styles={styles}
          />
        )}
      </BlurView>
    </View>
  );
}

type ArrowProps = {
  symbol: 'chevron.left' | 'chevron.right';
  label: string;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
};

function Arrow({ symbol, label, onPress, styles }: ArrowProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.arrow, !onPress && styles.arrowDisabled]}
    >
      <SymbolView name={symbol} weight="medium" tintColor={theme.colors.ink} size={theme.sizes.backIcon} />
    </Pressable>
  );
}

const makeStyles = (theme: Theme, hideWeekArrows = false) =>
  StyleSheet.create({
    shadow: {
      borderRadius: theme.radii.xl,
      boxShadow: theme.shadows.glass,
    },
    blur: {
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xxs,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.glassBorder,
      backgroundColor: theme.colors.glassFill,
    },
    arrow: {
      width: theme.sizes.dayArrow,
      height: theme.sizes.mealTouch,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowDisabled: {
      opacity: theme.opacity.disabled,
    },
    days: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: hideWeekArrows ? theme.spacing.xs : 0,
    },
    day: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.hair,
    },
    initial: {
      textAlign: 'center',
    },
    chip: {
      width: theme.sizes.dayChip,
      height: theme.sizes.dayChip,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: theme.colors.nutrition,
    },
  });
