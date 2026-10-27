import type { ReactElement, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { RefreshControlProps, StyleProp, ViewStyle } from 'react-native';
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
  /** Space below the top safe-area inset. Use this, not `paddingTop` in `contentStyle`, which replaces the inset. */
  topGap?: number;
  /**
   * Pull-to-refresh control for scrolling screens. On iOS the top safe-area inset then moves from
   * content padding to the scroll view's content inset, so the spinner sits below the status bar.
   */
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function Screen({
  children,
  scroll = false,
  bottomInset = 0,
  contentStyle,
  gutter,
  topGap = 0,
  refreshControl,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const sideGutter = gutter ?? theme.spacing.xxl;
  const insetOnScrollView = scroll && refreshControl !== undefined && Platform.OS === 'ios';
  const padding = {
    paddingTop: (insetOnScrollView ? 0 : insets.top) + topGap,
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
        contentInset={insetOnScrollView ? { top: insets.top } : undefined}
        contentOffset={insetOnScrollView ? { x: 0, y: -insets.top } : undefined}
        refreshControl={refreshControl}
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
