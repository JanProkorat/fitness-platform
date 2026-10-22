import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type SectionHeaderProps = {
  title: string;
  /** Element at the right end of the header, such as an Edit link. */
  trailing?: ReactNode;
};

/** Small uppercase label above a list card. */
export function SectionHeader({ title, trailing }: SectionHeaderProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const heading = (
    <Text variant="overline" color="muted" accessibilityRole="header" style={styles.title}>
      {title.toUpperCase()}
    </Text>
  );

  if (!trailing) return heading;

  return (
    <View style={styles.row}>
      {heading}
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    title: {
      paddingHorizontal: theme.spacing.xxs,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    trailing: {
      marginLeft: 'auto',
      paddingHorizontal: theme.spacing.xxs,
    },
  });
