import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { ClientOwnPlanItem } from '@/api/generated';
import { isoDay } from '@/components/nutrition/plan/model';
import { calendarParts, daysUntil, weekdayName } from '@/components/nutrition/upcoming/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import type { CoachRole } from './collaborationRoles';
import { roleLook } from './roleLook';

type UpcomingPlanRowProps = {
  role: CoachRole;
  plan: ClientOwnPlanItem;
  /** Local today as `yyyy-MM-dd`. */
  today: string;
};

/** A published plan that starts later: date tile, plan name, length and days to go; opens the area's tab. */
export function UpcomingPlanRow({ role, plan, today }: UpcomingPlanRowProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const look = roleLook(theme, role);
  const area = role === 'Trainer' ? 'training' : 'nutrition';

  const start = calendarParts(i18n.language, plan.startDate);
  const days = daysUntil(isoDay(plan.startDate), today);
  const title = t(`today.areaBlocks.startsOn.${area}`, { weekday: weekdayName(i18n.language, plan.startDate) });
  const subtitle = t('nutritionUpcoming.subtitle', {
    plan: plan.planName ?? '',
    weeks: t('nutritionUpcoming.weeks', { count: plan.totalWeeks ?? 0 }),
    days: t('nutritionUpcoming.inDays', { count: days }),
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={() => router.navigate(role === 'Trainer' ? '/training' : '/nutrition')}
      style={styles.row}
    >
      <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.tileMonth, { backgroundColor: look.strong }]}>
          <Text variant="micro" color={role === 'Trainer' ? 'onTraining' : 'onNutrition'} style={styles.tileMonthText}>
            {start.month}
          </Text>
        </View>
        <View style={styles.tileDay}>
          <Text variant="barTitle">{start.day}</Text>
        </View>
      </View>
      <View style={styles.copy}>
        <View style={styles.area}>
          <SymbolView name={look.symbol} tintColor={look.ink} size={theme.sizes.roleBadgeGlyph} />
          <Text variant="micro" style={[styles.areaText, { color: look.ink }]}>
            {t(`today.areaBlocks.area.${area}`).toUpperCase()}
          </Text>
        </View>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="muted" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    tile: {
      width: theme.sizes.areaTileWidth,
      height: theme.sizes.areaTileHeight,
      borderRadius: theme.radii.md,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      overflow: 'hidden',
    },
    tileMonth: {
      paddingVertical: theme.spacing.hair / 2,
      alignItems: 'center',
    },
    tileMonthText: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    tileDay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    area: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.snug,
    },
    areaText: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
  });
