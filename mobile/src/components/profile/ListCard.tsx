import { Children } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Rounded card that stacks rows with a hairline between them. */
export function ListCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const rows = Children.toArray(children);

  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? styles.divider : undefined}>
          {row}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.xxs,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
  });
