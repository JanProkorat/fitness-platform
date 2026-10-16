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
};

export function Screen({ children, scroll = false, bottomInset = 0, contentStyle }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme);
  const padding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom + bottomInset,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        contentContainerStyle={[padding, contentStyle]}
        contentInsetAdjustmentBehavior="never"
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
