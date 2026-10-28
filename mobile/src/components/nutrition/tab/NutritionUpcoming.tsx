import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import type { Collaboration } from '@/api/collaborations';
import type { ClientOwnPlanItem } from '@/api/generated';
import { GetReady } from '@/components/nutrition/upcoming/GetReady';
import { StartCard } from '@/components/nutrition/upcoming/StartCard';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NutritionUpcomingProps = {
  plan: ClientOwnPlanItem;
  /** The client's nutritionist collaboration, when one is listed. */
  collaboration: Collaboration | undefined;
  /** True when the client has exactly one covering collaboration. */
  onlyCollaboration: boolean;
  /** Local today as `yyyy-MM-dd`. */
  today: string;
};

/** A published plan that starts later: who published it, when it starts, and what to prepare. */
export function NutritionUpcoming({ plan, collaboration, onlyCollaboration, today }: NutritionUpcomingProps) {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <StartCard
        plan={plan}
        collaboration={collaboration}
        today={today}
        onBrowse={() => router.push({ pathname: '/nutrition/plan/week/[weekNumber]', params: { weekNumber: '1' } })}
      />
      <GetReady planId={plan.planId} collaboration={collaboration} onlyCollaboration={onlyCollaboration} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xl,
    },
  });
