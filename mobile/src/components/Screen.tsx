import type { ReactElement, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { RefreshControlProps, StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { useTabBarScrollHandler } from './TabBarCollapse';

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
  /**
   * Fixed header above a scrolling body. It takes the top safe-area inset and `topGap`; only the body
   * scrolls, and a refresh spinner sits just below it. Needs `scroll`.
   */
  header?: ReactNode;
  /** Collapses the tab bar into a pill while this screen scrolls down. Only the tab screens set it. */
  collapseTabBar?: boolean;
};

export function Screen({
  children,
  scroll = false,
  bottomInset = 0,
  contentStyle,
  gutter,
  topGap = 0,
  refreshControl,
  header,
  collapseTabBar = false,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const sideGutter = gutter ?? theme.spacing.xxl;
  const onTabBarScroll = useTabBarScrollHandler();
  const fixedHeader = scroll && header !== undefined;
  const insetOnScrollView =
    scroll && !fixedHeader && refreshControl !== undefined && Platform.OS === 'ios';
  const padding = {
    paddingTop: fixedHeader ? 0 : (insetOnScrollView ? 0 : insets.top) + topGap,
    paddingBottom: insets.bottom + bottomInset,
    paddingLeft: insets.left + sideGutter,
    paddingRight: insets.right + sideGutter,
  };

  if (scroll) {
    const body = (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[padding, contentStyle]}
        contentInsetAdjustmentBehavior="never"
        contentInset={insetOnScrollView ? { top: insets.top } : undefined}
        contentOffset={insetOnScrollView ? { x: 0, y: -insets.top } : undefined}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        onScroll={collapseTabBar ? onTabBarScroll : undefined}
        scrollEventThrottle={collapseTabBar ? 16 : undefined}
      >
        {children}
      </ScrollView>
    );
    if (!fixedHeader) {
      return body;
    }
    const headerPadding = {
      paddingTop: insets.top + topGap,
      paddingBottom: theme.spacing.xl,
      paddingLeft: insets.left + sideGutter,
      paddingRight: insets.right + sideGutter,
    };
    return (
      <View style={styles.root}>
        <View style={headerPadding}>{header}</View>
        {body}
      </View>
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
