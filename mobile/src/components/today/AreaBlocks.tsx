import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { ClientOwnPlanItem } from '@/api/generated';
import { isoDay } from '@/components/nutrition/plan/model';
import { calendarParts } from '@/components/nutrition/upcoming/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CoachBuildingRow } from './CoachBuildingRow';
import { NextPlanStrip } from './NextPlanStrip';
import { RoleRow } from './RoleRow';
import { RunningNutritionCard } from './RunningNutritionCard';
import type { AreaBlock } from './todayBlocks';
import { UpcomingPlanRow } from './UpcomingPlanRow';

type AreaBlocksProps = {
  blocks: readonly AreaBlock[];
  /** Local today as `yyyy-MM-dd`. */
  today: string;
};

/** True when the area has something to render; a running training plan has no block here yet. */
export const hasAreaBlock = (block: AreaBlock): boolean =>
  block.state.kind !== 'running' || block.role === 'Nutritionist';

/** "<plan name> · starts <weekday> <day month>" in the app language. */
function nextPlanSubtitle(t: TFunction, language: string, plan: ClientOwnPlanItem): string {
  const start = calendarParts(language, plan.startDate);
  // calendarParts is UTC-parsed (0 = Sunday); the copy keys are ISO weekdays (1 = Monday, 7 = Sunday).
  const isoWeekday = start.weekday === 0 ? 7 : start.weekday;
  const date = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${isoDay(plan.startDate)}T00:00:00Z`),
  );
  return t('today.nextPlan.subtitle', {
    plan: plan.planName ?? '',
    when: `${t(`today.areaBlocks.weekday.${isoWeekday}`)} ${date}`,
  });
}

/** One block per area, chosen by the area's state. */
export function AreaBlocks({ blocks, today }: AreaBlocksProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.list}>
      {blocks.map(({ role, state }) => {
        switch (state.kind) {
          case 'startsLater':
            return <UpcomingPlanRow key={role} role={role} plan={state.plan} today={today} />;
          case 'building':
            return <CoachBuildingRow key={role} role={role} collaboration={state.collaboration} />;
          case 'noCoach':
            return (
              <RoleRow
                key={role}
                role={role}
                mode="add"
                onPress={() => router.push({ pathname: '/coach-search', params: { role } })}
              />
            );
          case 'running':
            return role === 'Nutritionist' ? (
              <RunningNutritionCard
                key={role}
                plan={state.plan}
                today={today}
                footer={
                  state.next ? (
                    <NextPlanStrip
                      title={t('today.nextPlan.title')}
                      subtitle={nextPlanSubtitle(t, i18n.language, state.next)}
                      onPress={() =>
                        router.push({ pathname: '/nutrition/plan', params: { planId: state.next?.planId } })
                      }
                    />
                  ) : undefined
                }
              />
            ) : null;
          default:
            return null;
        }
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
    },
  });
