import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CoachBuildingRow } from './CoachBuildingRow';
import { RoleRow } from './RoleRow';
import type { AreaBlock } from './todayBlocks';
import { UpcomingPlanRow } from './UpcomingPlanRow';

type AreaBlocksProps = {
  blocks: readonly AreaBlock[];
  /** Local today as `yyyy-MM-dd`. */
  today: string;
};

/** True when the area has something to render; a running plan has no block here yet. */
export const hasAreaBlock = (block: AreaBlock): boolean => block.state.kind !== 'running';

/** One block per area, chosen by the area's state. */
export function AreaBlocks({ blocks, today }: AreaBlocksProps) {
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
