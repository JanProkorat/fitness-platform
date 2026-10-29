import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { RoleRow } from './RoleRow';
import type { AreaBlock } from './todayBlocks';

type AddCoachRowsProps = {
  blocks: readonly AreaBlock[];
};

/** One "Add a trainer / nutritionist" row per area that has no coach yet. */
export function AddCoachRows({ blocks }: AddCoachRowsProps) {
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const roles = blocks.filter((block) => block.state.kind === 'noCoach').map((block) => block.role);

  if (roles.length === 0) return null;

  return (
    <View style={styles.list}>
      {roles.map((role) => (
        <RoleRow
          key={role}
          role={role}
          mode="add"
          onPress={() => router.push({ pathname: '/coach-search', params: { role } })}
        />
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      gap: theme.spacing.sm,
    },
  });
