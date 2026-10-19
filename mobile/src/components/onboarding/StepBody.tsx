import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type StepBodyProps = {
  children: ReactNode;
};

/** Vertical rhythm shared by the onboarding steps. */
export function StepBody({ children }: StepBodyProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return <View style={styles.body}>{children}</View>;
}

/** A caption with the control below it. */
export function StepGroup({ children }: StepBodyProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  return <View style={styles.group}>{children}</View>;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    body: {
      gap: theme.spacing.xxl,
    },
    group: {
      gap: theme.spacing.xs,
    },
  });
