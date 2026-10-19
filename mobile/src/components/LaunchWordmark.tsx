import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { LogoMark } from '@/components/LogoMark';
import { launchMotion, launchTracking, sizes, useTheme } from '@/theme';

const settleEase = Easing.bezierFn(0.3, 0, 0.2, 1);

type Props = {
  /** Elapsed launch time in ms. */
  progress: SharedValue<number>;
};

/** Launch variant of the wordmark: the checklist mark replaces the F and the letters animate in. */
export function LaunchWordmark({ progress }: Props) {
  const theme = useTheme();

  const lettersStyle = useAnimatedStyle(() => {
    const raw = (progress.value - launchMotion.wordmarkStart) / launchMotion.wordmarkDuration;
    const eased = raw <= 0 ? 0 : raw >= 1 ? 1 : settleEase(raw);
    return {
      opacity: eased,
      letterSpacing: launchTracking.from + (launchTracking.to - launchTracking.from) * eased,
    };
  });

  return (
    <View style={[styles.row, { paddingLeft: launchTracking.to }]}>
      <View style={{ marginRight: sizes.launchMarkGap }}>
        <LogoMark progress={progress} />
      </View>
      <Animated.Text
        numberOfLines={1}
        style={[theme.typography.launchWordmark, { color: theme.colors.ink }, lettersStyle]}
      >
        ORM <Text style={{ color: theme.colors.launchUp }}>UP</Text>
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
