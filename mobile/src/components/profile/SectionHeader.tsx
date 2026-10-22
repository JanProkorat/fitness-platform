import { StyleSheet } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** Small uppercase label above a list card. */
export function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <Text variant="overline" color="muted" accessibilityRole="header" style={styles.title}>
      {title.toUpperCase()}
    </Text>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      paddingHorizontal: theme.spacing.xxs,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
  });
