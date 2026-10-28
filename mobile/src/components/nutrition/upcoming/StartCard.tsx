import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { Collaboration } from '@/api/collaborations';
import type { ClientOwnPlanItem } from '@/api/generated';
import { Chip } from '@/components/Chip';
import { firstName, initials } from '@/components/invites/format';
import { isoDay } from '@/components/nutrition/plan/model';
import { calendarParts, daysUntil } from '@/components/nutrition/upcoming/format';
import { StatStrip, hasAverages } from '@/components/nutrition/upcoming/StatStrip';
import { Text } from '@/components/Text';
import { findConversation } from '@/components/today/coachSteps';
import { useConversations } from '@/hooks/useConversations';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type StartCardProps = {
  plan: ClientOwnPlanItem;
  /** The nutritionist who published the plan; absent when no such collaboration is listed. */
  collaboration: Collaboration | undefined;
  /** Local today as `yyyy-MM-dd`. */
  today: string;
  onBrowse: () => void;
};

/** The upcoming plan's hero card: who published it, when it starts, its daily averages, and a way in. */
export function StartCard({ plan, collaboration, today, onBrowse }: StartCardProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: conversations } = useConversations();

  const fullName = collaboration?.professionalName?.trim() ?? '';
  const first = firstName(fullName) || t('today.progress.coachFallback');
  const start = calendarParts(i18n.language, plan.startDate);
  const days = daysUntil(isoDay(plan.startDate), today);
  const subtitle = t('nutritionUpcoming.subtitle', {
    plan: plan.planName ?? '',
    weeks: t('nutritionUpcoming.weeks', { count: plan.totalWeeks ?? 0 }),
    days: t('nutritionUpcoming.inDays', { count: days }),
  });

  const openChat = () => {
    const target = collaboration ? findConversation(conversations, collaboration) : undefined;
    if (target?.id) router.push({ pathname: '/chat/[id]', params: { id: target.id } });
    else router.push('/messages');
  };

  return (
    <View style={styles.card}>
      {collaboration ? (
        <View style={styles.header}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text variant="bodyStrong" style={{ color: theme.colors.onAvatar }}>
              {initials(fullName)}
            </Text>
          </View>
          <View style={styles.who}>
            <Text variant="subtitle" numberOfLines={1}>
              {fullName || first}
            </Text>
            <View style={styles.meta}>
              <Chip size="sm" variant="nutrition" label={t('invites.roles.Nutritionist')} />
              <Text variant="caption" color="muted">
                {t('nutritionUpcoming.published')}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.progress.messageLabel', { name: first })}
            onPress={openChat}
            style={styles.iconButton}
          >
            <SymbolView name="bubble.left" tintColor={theme.colors.ink} size={theme.sizes.bellGlyph} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.when}>
        <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.tileMonth}>
            <Text variant="micro" color="onNutrition" style={styles.tileMonthText}>
              {start.month}
            </Text>
          </View>
          <View style={styles.tileDay}>
            <Text variant="barTitle">{start.day}</Text>
          </View>
        </View>
        <View style={styles.whenCopy}>
          <Text variant="heading" accessibilityRole="header">
            {t('nutritionUpcoming.title', { when: t(`nutritionUpcoming.on.${start.weekday}`) })}
          </Text>
          <Text variant="label" color="muted">
            {subtitle}
          </Text>
        </View>
      </View>

      {hasAverages(plan) ? <StatStrip plan={plan} /> : null}

      <Pressable accessibilityRole="button" onPress={onBrowse} style={styles.browse}>
        <Text variant="button" color="onPrimary">
          {t('nutritionUpcoming.browse')}
        </Text>
        <SymbolView name="arrow.right" tintColor={theme.colors.onPrimary} size={theme.sizes.rowGlyph} />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.lg,
      padding: theme.spacing.roomy,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    avatar: {
      width: theme.sizes.progressAvatar,
      height: theme.sizes.progressAvatar,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.avatar,
    },
    who: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: theme.spacing.snug,
      rowGap: theme.spacing.xxs,
    },
    iconButton: {
      width: theme.sizes.messageButton,
      height: theme.sizes.messageButton,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
    },
    when: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    tile: {
      width: theme.sizes.calendarTileWidth,
      height: theme.sizes.calendarTileHeight,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      overflow: 'hidden',
    },
    tileMonth: {
      paddingVertical: theme.spacing.hair,
      alignItems: 'center',
      backgroundColor: theme.colors.nutrition,
    },
    tileMonthText: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    tileDay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    browse: {
      height: theme.sizes.field,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.primary,
    },
    whenCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
  });
