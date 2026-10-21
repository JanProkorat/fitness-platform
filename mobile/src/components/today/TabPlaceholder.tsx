import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type TabPlaceholderProps = {
  title: string;
  body: string;
  children?: ReactNode;
};

/** Stand-in body for a tab whose screen is not built yet. */
export function TabPlaceholder({ title, body, children }: TabPlaceholderProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const barClearance = theme.sizes.tabBar + theme.sizes.tabBarBottom + theme.spacing.xxl;

  return (
    <Screen
      scroll
      topGap={theme.spacing.safeAreaGap}
      bottomInset={barClearance}
      contentStyle={styles.content}
    >
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <Text variant="bodyLarge" color="muted">
        {body}
      </Text>
      {children}
    </Screen>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
    },
  });
