import Animated, { Easing, useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { launchMotion, sizes, useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const popEase = Easing.bezierFn(0.3, 1.7, 0.5, 1);
const drawEase = Easing.bezierFn(0.6, 0, 0.2, 1);
const tickEase = Easing.out(Easing.quad);

// Geometry literals below mirror the GlassLaunchQuiet board SVG (viewBox 15 17 73 67).
const VIEW_BOX = '15 17 73 67';
const CIRCLE_R = 9;
const RING_R = 7.5;
const RING_STROKE = 4;
const BAR_STROKE = 16;
const TICK_STROKE = 2.6;
const BAR_LONG = 40;
const BAR_SHORT = 26;
const TICK_LENGTH = 12.1;
const TICK_PATH = 'M-4 0.5 L-1.2 3.4 L4.2 -2.6';

/** Eased 0..1 position of `elapsed` inside the [start, start + duration] window. */
const windowProgress = (
  elapsed: number,
  start: number,
  duration: number,
  ease: (value: number) => number,
): number => {
  'worklet';
  const raw = (elapsed - start) / duration;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return ease(raw);
};

export type LogoMarkPalette = {
  top: string;
  bottom: string;
  ring: string;
  tick: string;
};

type Props = {
  /** Elapsed launch time in ms; omitted renders the finished mark. */
  progress?: SharedValue<number>;
  /** Rendered size; defaults to the launch mark size. */
  width?: number;
  height?: number;
  /** Mark colours; defaults to the launch palette. */
  palette?: LogoMarkPalette;
};

/** Form Up checklist mark: two ticked rows and an open ring, drawn in on the launch screen. */
export function LogoMark({ progress, width, height, palette }: Props) {
  const theme = useTheme();
  const finished = useSharedValue(launchMotion.total);
  const elapsed = progress ?? finished;
  const { popDuration, popStagger, barStart, barDuration, barStagger, tickStart, tickDuration } =
    launchMotion;

  const deepCircle = useAnimatedProps(() => ({
    r: CIRCLE_R * windowProgress(elapsed.get(), 0, popDuration, popEase),
  }));
  const accentCircle = useAnimatedProps(() => ({
    r: CIRCLE_R * windowProgress(elapsed.get(), popStagger, popDuration, popEase),
  }));
  const ring = useAnimatedProps(() => {
    const scale = windowProgress(elapsed.get(), popStagger * 2, popDuration, popEase);
    return { r: RING_R * scale, strokeWidth: RING_STROKE * scale };
  });
  const deepBar = useAnimatedProps(() => {
    const drawn = windowProgress(elapsed.get(), barStart, barDuration, drawEase);
    return { strokeDashoffset: BAR_LONG * (1 - drawn), opacity: drawn > 0 ? 1 : 0 };
  });
  const accentBar = useAnimatedProps(() => {
    const drawn = windowProgress(elapsed.get(), barStart + barStagger, barDuration, drawEase);
    return { strokeDashoffset: BAR_SHORT * (1 - drawn), opacity: drawn > 0 ? 1 : 0 };
  });
  const tick = useAnimatedProps(() => {
    const drawn = windowProgress(elapsed.get(), tickStart, tickDuration, tickEase);
    return { strokeDashoffset: TICK_LENGTH * (1 - drawn), opacity: drawn > 0 ? 1 : 0 };
  });

  const { colors } = theme;
  const {
    top,
    bottom,
    ring: ringColor,
    tick: tickColor,
  } = palette ?? {
    top: colors.launchMarkDeep,
    bottom: colors.accent,
    ring: colors.launchRing,
    tick: colors.onAccent,
  };

  return (
    <Svg
      width={width ?? sizes.launchMarkWidth}
      height={height ?? sizes.launchMarkHeight}
      viewBox={VIEW_BOX}
      style={{ overflow: 'visible' }}
    >
      <AnimatedCircle cx={24} cy={26} animatedProps={deepCircle} fill={top} />
      <AnimatedPath
        d={TICK_PATH}
        transform="translate(24 26)"
        fill="none"
        stroke={tickColor}
        strokeWidth={TICK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[TICK_LENGTH, TICK_LENGTH]}
        animatedProps={tick}
      />
      <AnimatedPath
        d="M40 26 H80"
        fill="none"
        stroke={top}
        strokeWidth={BAR_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[BAR_LONG, BAR_LONG]}
        animatedProps={deepBar}
      />
      <AnimatedCircle cx={24} cy={50} animatedProps={accentCircle} fill={bottom} />
      <AnimatedPath
        d="M40 50 H66"
        fill="none"
        stroke={bottom}
        strokeWidth={BAR_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={[BAR_SHORT, BAR_SHORT]}
        animatedProps={accentBar}
      />
      <AnimatedCircle
        cx={24}
        cy={74}
        animatedProps={ring}
        fill="none"
        stroke={ringColor}
      />
    </Svg>
  );
}
