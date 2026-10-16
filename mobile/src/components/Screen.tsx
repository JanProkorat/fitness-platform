import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom space, e.g. to clear a floating tab bar. */
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
  /** Horizontal gutter beside the safe area; defaults to `spacing.xxl`. */
  gutter?: number;
};

export function Screen({
  children,
  scroll = false,
  bottomInset = 0,
  contentStyle,
  gutter,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const sideGutter = gutter ?? theme.spacing.xxl;
  const padding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom + bottomInset,
    paddingLeft: insets.left + sideGutter,
    paddingRight: insets.right + sideGutter,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[padding, contentStyle]}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.root, padding, contentStyle]}>{children}</View>;
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.ground,
    },
  });
