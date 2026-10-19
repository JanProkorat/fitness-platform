import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Wordmark } from '@/components/Wordmark';
import { launchGlows as launchGlowGeometry, launchMotion, sizes, useTheme } from '@/theme';
import type { GlowColor } from '@/theme';

const taglineEase = Easing.bezierFn(0.3, 0, 0.2, 1);
const GLOW_FADE_STOP = 0.7;

type GlowProps = {
  id: string;
  glow: GlowColor;
  geometry: { rx: number; ry: number; x: number; y: number };
  width: number;
  height: number;
};

function Glow({ id, glow, geometry, width, height }: GlowProps) {
  return (
    <>
      <Defs>
        <RadialGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          cx={geometry.x * width}
          cy={geometry.y * height}
          rx={geometry.rx}
          ry={geometry.ry}
        >
          <Stop offset={0} stopColor={glow.color} stopOpacity={glow.opacity} />
          <Stop offset={GLOW_FADE_STOP} stopColor={glow.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </>
  );
}

type Props = {
  /** True once the app can show its first real screen; the overlay then fades out. */
  ready: boolean;
  onExited: () => void;
};

/** Full-screen launch animation: plays once, holds the last frame, fades out when `ready`. */
export function LaunchScreen({ ready, onExited }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? launchMotion.total : 0);
  const opacity = useSharedValue(1);
  const [played, setPlayed] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    progress.value = withTiming(
      launchMotion.total,
      { duration: launchMotion.total, easing: Easing.linear },
      (finished) => {
        if (finished) {
          scheduleOnRN(setPlayed, true);
        }
      },
    );
  }, [reduceMotion, progress]);

  useEffect(() => {
    if (!(played && ready)) {
      return;
    }
    if (reduceMotion) {
      onExited();
      return;
    }
    opacity.value = withTiming(
      0,
      { duration: launchMotion.exitDuration, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (finished) {
          scheduleOnRN(onExited);
        }
      },
    );
  }, [played, ready, reduceMotion, opacity, onExited]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const taglineStyle = useAnimatedStyle(() => {
    const raw = (progress.value - launchMotion.taglineStart) / launchMotion.taglineDuration;
    const eased = raw <= 0 ? 0 : raw >= 1 ? 1 : taglineEase(raw);
    return {
      opacity: eased,
      transform: [{ translateY: sizes.launchTaglineRise * (1 - eased) }],
    };
  });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('launch.label')}
      style={[styles.overlay, { backgroundColor: theme.colors.ground }, containerStyle]}
    >
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Glow
          id="launchGlowTop"
          glow={theme.launchGlows.top}
          geometry={launchGlowGeometry.top}
          width={width}
          height={height}
        />
        <Glow
          id="launchGlowBottom"
          glow={theme.launchGlows.bottom}
          geometry={launchGlowGeometry.bottom}
          width={width}
          height={height}
        />
        <Glow
          id="launchGlowCorner"
          glow={theme.launchGlows.corner}
          geometry={launchGlowGeometry.corner}
          width={width}
          height={height}
        />
      </Svg>
      <View style={[styles.stack, { gap: sizes.launchStackGap }]}>
        <Wordmark variant="launch" progress={progress} />
        <Animated.Text
          style={[theme.typography.launchTagline, { color: theme.colors.muted }, taglineStyle]}
        >
          {t('launch.tagline')}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    alignItems: 'center',
  },
});
