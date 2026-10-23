import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useNavigationState } from 'expo-router/react-navigation';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { tabSwitchMotion } from '@/theme/motion';

/**
 * Fades a tab's content in when the tab navigator switches to this tab, and once on first mount
 * while focused. Regaining focus after a stack pop leaves the navigator index unchanged: no fade.
 */
export function TabFade({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const tabIndex = useNavigationState((state) => state.index);
  const previousIndex = useRef<number | null>(null);

  useEffect(() => {
    const indexChanged = previousIndex.current !== tabIndex;
    previousIndex.current = tabIndex;
    if (!focused || reduceMotion || !indexChanged) {
      return;
    }
    opacity.set(0);
    opacity.set(withTiming(1, { duration: tabSwitchMotion.duration }));
    return () => {
      cancelAnimation(opacity);
      opacity.set(1);
    };
  }, [focused, tabIndex, reduceMotion, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.ground }]}>
      <Animated.View style={[styles.root, fadeStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
