import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RecipesStateProps = {
  kind: 'pending' | 'message';
  title?: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Loading, empty or error block shown in place of the recipe list. */
export function RecipesState({ kind, title, body, actionLabel, onAction }: RecipesStateProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  if (kind === 'pending') {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }
  return (
    <View style={styles.state}>
      <Text variant="heading" accessibilityRole="header" style={styles.centered}>
        {title}
      </Text>
      <Text variant="body" color="muted" style={styles.centered}>
        {body}
      </Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    state: {
      gap: theme.spacing.xl,
      paddingVertical: theme.spacing.huge,
    },
    centered: {
      textAlign: 'center',
    },
  });
