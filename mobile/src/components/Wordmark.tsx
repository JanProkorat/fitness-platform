import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { LogoMark } from '@/components/LogoMark';
import { launchMotion, launchTracking, sizes, useTheme } from '@/theme';

const settleEase = Easing.bezierFn(0.3, 0, 0.2, 1);

type Props = {
  /** `launch` swaps the F for the checklist mark and animates in from `progress`. */
  variant?: 'default' | 'launch';
  /** Elapsed launch time in ms; omitted renders the finished wordmark. */
  progress?: SharedValue<number>;
};

export function Wordmark({ variant = 'default', progress }: Props) {
  const theme = useTheme();
  const finished = useSharedValue(launchMotion.total);
  const elapsed = progress ?? finished;

  const lettersStyle = useAnimatedStyle(() => {
    const raw = (elapsed.value - launchMotion.wordmarkStart) / launchMotion.wordmarkDuration;
    const eased = raw <= 0 ? 0 : raw >= 1 ? 1 : settleEase(raw);
    return {
      opacity: eased,
      letterSpacing: launchTracking.from + (launchTracking.to - launchTracking.from) * eased,
    };
  });

  if (variant === 'launch') {
    return (
      <View style={[styles.launchRow, { paddingLeft: launchTracking.to }]}>
        <View style={{ marginRight: sizes.launchMarkGap }}>
          <LogoMark progress={progress} />
        </View>
        <Animated.Text
          numberOfLines={1}
          style={[
            theme.typography.launchWordmark,
            { color: theme.colors.ink },
            lettersStyle,
          ]}
        >
          ORM <Text style={{ color: theme.colors.launchUp }}>UP</Text>
        </Animated.Text>
      </View>
    );
  }

  return (
    <Text numberOfLines={1} style={[theme.typography.wordmark, { color: theme.colors.wordmarkInk }]}>
      FORM <Text style={{ color: theme.colors.wordmarkAccent }}>UP</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  launchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
