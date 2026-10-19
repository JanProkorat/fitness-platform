import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RatingEndsProps = {
  low: string;
  high: string;
};

/** The words under both ends of a rating scale. */
export function RatingEnds({ low, high }: RatingEndsProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.row}>
      <Text variant="label" color="muted" style={styles.end}>
        {low}
      </Text>
      <Text variant="label" color="muted" style={[styles.end, styles.right]}>
        {high}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingTop: theme.spacing.snug,
    },
    end: {
      flex: 1,
    },
    right: {
      textAlign: 'right',
    },
  });
