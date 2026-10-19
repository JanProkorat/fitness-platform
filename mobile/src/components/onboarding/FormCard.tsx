import { Children } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type FormCardProps = {
  children: ReactNode;
};

/** A card of form rows separated by hairlines. */
export function FormCard({ children }: FormCardProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const rows = Children.toArray(children);

  return (
    <Card style={styles.card}>
      {rows.map((row, index) => (
        <View key={index} style={index > 0 ? styles.separated : undefined}>
          {row}
        </View>
      ))}
    </Card>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.lg,
    },
    separated: {
      paddingTop: theme.spacing.lg,
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
  });
