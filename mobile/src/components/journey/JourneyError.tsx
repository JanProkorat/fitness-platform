import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type JourneyErrorProps = { message: string; retryLabel: string; onRetry: () => void };

/** Message with a retry button, shown in place of a section that failed to load. */
export function JourneyError({ message, retryLabel, onRetry }: JourneyErrorProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.error}>
      <Text variant="body" color="muted" style={styles.centered}>
        {message}
      </Text>
      <Button label={retryLabel} size="small" onPress={onRetry} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    error: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
    },
    centered: {
      textAlign: 'center',
    },
  });
