import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClientOwnPlanItem, GetClientPlanSummaryResponse } from '@/api/generated';
import { isActivePlan, planKind } from '@/api/plans';
import { Text } from '@/components/Text';
import {
  EMPTY_VALUE,
  changeLabel,
  parseTime,
  percentLabel,
  planPeriodLabel,
  planWindow,
} from '@/components/journey/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PlanRowProps = {
  plan: ClientOwnPlanItem;
  /** Current time in ms, used to end an active plan's period. */
  now: number;
  /** Summary of a finished plan; supplies the weight change shown on its row. */
  summary?: GetClientPlanSummaryResponse;
  /** Only finished plans open the Plan summary; an active plan row is shown but not pressable. */
  onPress?: () => void;
};

/** One plan in the Plans card: kind bar, name, status pill, coach and period, and progress. */
export function PlanRow({ plan, now, summary, onPress }: PlanRowProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const theme = useTheme();
  const styles = makeStyles(theme);
  const kind = planKind(plan);
  const active = isActivePlan(plan);
  const tone =
    kind === 'training'
      ? { bar: theme.colors.training, soft: theme.colors.trainingSoft, ink: theme.colors.trainingInk }
      : { bar: theme.colors.nutrition, soft: theme.colors.nutritionSoft, ink: theme.colors.nutritionInk };

  const window = planWindow(plan, now, active);
  const coachFirstName = plan.professionalName?.trim().split(/\s+/)[0];
  const meta = [
    coachFirstName,
    planPeriodLabel(t, language, parseTime(plan.startDate), window ? window.to : null, active),
  ]
    .filter(Boolean)
    .join(' · ');

  const progress: string[] = [];
  if (active && plan.currentWeek !== undefined && plan.totalWeeks) {
    progress.push(t('journey.plan.week', { current: plan.currentWeek, total: plan.totalWeeks }));
  }
  if (kind === 'training' && plan.sessionsTotal !== undefined && plan.sessionsDone !== undefined) {
    progress.push(t('journey.plan.sessions', { done: plan.sessionsDone, total: plan.sessionsTotal }));
  }
  if (kind === 'nutrition' && plan.mealsLoggedPercent !== undefined) {
    progress.push(t('journey.plan.mealsLogged', { value: percentLabel(t, language, plan.mealsLoggedPercent) }));
  }
  const weightChange = active
    ? EMPTY_VALUE
    : changeLabel(t, language, summary?.weightStartKg, summary?.weightEndKg, 'kg');
  if (weightChange !== EMPTY_VALUE) progress.push(weightChange);

  const fill =
    active && plan.currentWeek !== undefined && plan.totalWeeks
      ? Math.min(1, Math.max(0, plan.currentWeek / plan.totalWeeks))
      : null;

  const statusLabel = active ? t('journey.status.active') : t('journey.status.completed');
  const content = (
    <>
      <View style={[styles.bar, { backgroundColor: tone.bar }]} />
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.titles}>
            <Text variant="subtitle" numberOfLines={2}>
              {plan.planName}
            </Text>
            {meta ? (
              <Text variant="bodySmall" color="muted" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
          <View style={[styles.pill, { backgroundColor: active ? tone.soft : theme.colors.tabSelected }]}>
            <Text variant="chipSmall" style={{ color: active ? tone.ink : theme.colors.ink2 }}>
              {statusLabel}
            </Text>
          </View>
        </View>
        {progress.length > 0 ? <Text variant="body">{progress.join(' · ')}</Text> : null}
        {fill !== null ? (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: tone.bar }]} />
          </View>
        ) : null}
      </View>
    </>
  );

  const label = [plan.planName, statusLabel, meta, progress.join(', ')].filter(Boolean).join(', ');

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      {content}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
    },
    bar: {
      width: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
    },
    titles: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    pill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radii.pill,
    },
    track: {
      height: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.lineStrong,
      overflow: 'hidden',
    },
    fill: {
      height: theme.sizes.progressBar,
      borderRadius: theme.radii.pill,
    },
  });
