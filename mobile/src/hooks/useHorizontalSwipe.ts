import { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { swipeMotion } from '@/theme/motion';

export type SwipeDirection = 'previous' | 'next';

type HorizontalSwipeOptions = {
  onSwipe: (direction: SwipeDirection) => void;
  /** Whether there is something to swipe to; without it the drag resists and springs back. */
  canGoPrevious: boolean;
  canGoNext: boolean;
  /** Changes when the content the swipe moved to has rendered; that is when the new content slides in. */
  contentKey: string;
};

/**
 * A horizontal pan for a view inside a vertical scroll. It activates only after a clear sideways move and gives up
 * on vertical drift, so scrolling keeps working. The view follows the finger on the UI thread; past the threshold it
 * slides out, `onSwipe` runs, and the new content slides in from the other side. Below it the view springs back.
 * A swipe left means "next", right means "previous". With Reduce Motion on nothing moves and the swipe commits at once.
 * Attach `gesture` to a `GestureDetector` and `style` to the view inside it (or to the part of it that should move).
 */
export function useHorizontalSwipe({ onSwipe, canGoPrevious, canGoNext, contentKey }: HorizontalSwipeOptions) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  // Set when a swipe has slid the old content out; the next content change slides the new content in.
  const slidingIn = useSharedValue(false);

  useEffect(() => {
    if (!slidingIn.get()) return;
    slidingIn.set(false);
    translateX.set(withTiming(0, { duration: swipeMotion.slideInDuration }));
  }, [contentKey, slidingIn, translateX]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-swipeMotion.claimDistance, swipeMotion.claimDistance])
        .failOffsetY([-swipeMotion.verticalTolerance, swipeMotion.verticalTolerance])
        .onUpdate((event) => {
          if (reduceMotion) return;
          const allowed = event.translationX < 0 ? canGoNext : canGoPrevious;
          translateX.set(allowed ? event.translationX : event.translationX * swipeMotion.resistance);
        })
        .onEnd((event, success) => {
          const next = event.translationX < 0;
          const allowed = next ? canGoNext : canGoPrevious;
          const far = Math.abs(event.translationX) >= swipeMotion.commitDistance;
          const fast = Math.abs(event.velocityX) >= swipeMotion.commitVelocity;
          const direction: SwipeDirection = (far ? event.translationX : event.velocityX) < 0 ? 'next' : 'previous';
          const committed = success && allowed && (far || fast);
          if (!committed) {
            if (!reduceMotion) translateX.set(withSpring(0, swipeMotion.spring));
            return;
          }
          if (reduceMotion) {
            scheduleOnRN(onSwipe, direction);
            return;
          }
          const away = direction === 'next' ? -width : width;
          translateX.set(
            withTiming(away, { duration: swipeMotion.slideOutDuration }, (finished) => {
              if (!finished) return;
              slidingIn.set(true);
              translateX.set(-away);
              scheduleOnRN(onSwipe, direction);
            }),
          );
        }),
    [canGoNext, canGoPrevious, onSwipe, reduceMotion, slidingIn, translateX, width],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    opacity: 1 - Math.min(Math.abs(translateX.get()) / width, 1),
  }));

  return { gesture, style };
}
