import { Animated, Dimensions, Easing } from 'react-native';

/**
 * #811 — direction-aware slide transition for the main bottom-tab
 * navigator, replacing the #784 cross-fade (`animation: 'fade'`).
 *
 * Bottom-tabs only ships three animation presets natively — 'none' | 'fade'
 * | 'shift' (see expo-router's TabAnimationName) — none of which produce a
 * full slide. This module supplies a custom `sceneStyleInterpolator` +
 * `transitionSpec` pair, following the same shape as expo-router's built-in
 * `forShift` (bottom-tabs/TransitionConfigs/SceneStyleInterpolators.js) but
 * translating the full screen width instead of a 50px shift, and dropping
 * the opacity fade so the result reads as a push, not a cross-dissolve.
 *
 * Direction correctness relies on how BottomTabView computes each route's
 * `progress` target (see bottom-tabs/views/BottomTabView.js):
 *   toValue = index === activeIndex ? 0 : index > activeIndex ? 1 : -1
 * Only the outgoing and incoming screens actually animate on a given tab
 * switch; every other route is snapped instantly. So when moving to a
 * higher-index tab, the outgoing screen animates progress 0 -> -1 (exits
 * left) while the incoming screen — already parked at progress 1 (off-
 * screen right) because its index is higher than the previously active tab
 * — animates 1 -> 0 (slides in from the right). Moving to a lower-index tab
 * mirrors this. No extra "direction" bookkeeping is needed on our side; the
 * sign of `progress` already encodes it.
 *
 * Tab state retention (AC#3): this interpolator only ever changes
 * `sceneStyle` on already-mounted screens driven by react-navigation's own
 * Animated.Value per route — it does not remount, re-key, or replace the
 * `Tabs` navigator with a Stack, so scroll position / form state on each
 * tab screen survives switches exactly as before.
 */

/** Input range used by BottomTabView for every route's progress value. */
const PROGRESS_INPUT_RANGE = [-1, 0, 1] as const;

/**
 * Maps the [-1, 0, 1] progress range to [-width, 0, width] translateX
 * targets for a given screen width. Extracted as a pure function so the
 * slide math can be unit-tested without touching Animated internals.
 */
export function getSlideOutputRange(screenWidth: number): [number, number, number] {
  return [-screenWidth, 0, screenWidth];
}

export type TabSceneInterpolationProps = {
  current: { progress: Animated.Value };
};

export type TabSceneInterpolatedStyle = {
  sceneStyle: {
    transform: { translateX: Animated.AnimatedInterpolation<number> }[];
  };
};

/**
 * Custom `sceneStyleInterpolator` for the client `(tabs)` navigator —
 * replaces `forFade` from #784. Slides the full screen width, direction-
 * aware per the reasoning above.
 */
export function tabSlideInterpolator({
  current,
}: TabSceneInterpolationProps): TabSceneInterpolatedStyle {
  const { width } = Dimensions.get('window');
  return {
    sceneStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [...PROGRESS_INPUT_RANGE],
            outputRange: getSlideOutputRange(width),
          }),
        },
      ],
    },
  };
}

/**
 * Timing config approximating the iOS-native `slide_from_right` push used
 * for the coach-profile stack transition (app/(client)/_layout.tsx:28-31).
 * That transition is a native UIKit push with no JS-exposed duration/easing,
 * so this is a deliberate approximation of its pace — not a pixel match.
 * Per the #811 design review, visual parity is not the bar; a convincing
 * directional slide at a comparable duration is.
 */
export const tabSlideTransitionSpec = {
  animation: 'timing' as const,
  config: {
    duration: 350,
    easing: Easing.out(Easing.cubic),
  },
};
