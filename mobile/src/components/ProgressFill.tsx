import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { progressFillMotion } from '@/theme/motion';

type ProgressFillProps = {
  /** Share of the track to fill, 0–1. */
  ratio: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

/** A progress bar's fill that eases to each new ratio instead of jumping; instant when Reduce Motion is on. */
export function ProgressFill({ ratio, color, style }: ProgressFillProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(
      reduceMotion
        ? ratio
        : withTiming(ratio, { duration: progressFillMotion.duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [ratio, reduceMotion, progress]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <Reanimated.View style={[style, { backgroundColor: color }, fillStyle]} />;
}
