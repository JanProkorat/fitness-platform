import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { tabSwitchMotion } from '@/theme/motion';

/** Fades a tab's content in each time the tab gains focus; rests at full opacity otherwise. */
export function TabFade({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const focused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!focused || reduceMotion) {
      return;
    }
    opacity.set(0);
    opacity.set(withTiming(1, { duration: tabSwitchMotion.duration }));
    return () => {
      cancelAnimation(opacity);
      opacity.set(1);
    };
  }, [focused, reduceMotion, opacity]);

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
