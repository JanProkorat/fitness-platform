import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type Stat = { key: string; value: string; label: string };

/** Three headline numbers in one card. */
export function StatsStrip({ stats }: { stats: Stat[] }) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      {stats.map((stat) => (
        <View key={stat.key} accessible accessibilityLabel={`${stat.label}, ${stat.value}`} style={styles.stat}>
          <Text variant="heading">{stat.value}</Text>
          <Text variant="caption" color="muted">
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.snug,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      gap: theme.spacing.xxs,
    },
  });
