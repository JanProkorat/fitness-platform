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
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { swipeMotion } from '@/theme/motion';

export type SwipeDirection = 'previous' | 'next';

/** The shared values behind one sliding view, so a swipe elsewhere can move it too. */
export type SlideTransition = { translateX: SharedValue<number>; slidingIn: SharedValue<boolean> };

/**
 * A view that slides out of the way and, once `contentKey` changes after a slide-out, slides the new content in
 * from the opposite side. Attach `style` to the view. `useHorizontalSwipe` drives it; other views can be moved with it.
 */
export function useSlideTransition(contentKey: string) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  // Set when the old content has slid out; the next content change slides the new content in.
  const slidingIn = useSharedValue(false);

  useEffect(() => {
    if (!slidingIn.get()) return;
    slidingIn.set(false);
    translateX.set(withTiming(0, { duration: swipeMotion.slideInDuration }));
  }, [contentKey, slidingIn, translateX]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    opacity: 1 - Math.min(Math.abs(translateX.get()) / width, 1),
  }));

  return { translateX, slidingIn, style, width };
}

type HorizontalSwipeOptions = {
  onSwipe: (direction: SwipeDirection) => void;
  /** Whether there is something to swipe to; without it the drag resists and springs back. */
  canGoPrevious: boolean;
  canGoNext: boolean;
  /** Changes when the content the swipe moved to has rendered; that is when the new content slides in. */
  contentKey: string;
  /** Other views that move with this one: they follow the drag, slide out together and slide in on their own key. */
  alsoSlide?: SlideTransition[];
};

/**
 * A horizontal pan for a view inside a vertical scroll. It activates only after a clear sideways move and gives up
 * on vertical drift, so scrolling keeps working. The view follows the finger on the UI thread; past the threshold it
 * slides out, `onSwipe` runs, and the new content slides in from the other side. Below it the view springs back.
 * A swipe left means "next", right means "previous". With Reduce Motion on nothing moves and the swipe commits at once.
 * Attach `gesture` to a `GestureDetector` and `style` to the view inside it (or to the part of it that should move).
 * `slide(direction)` runs the same transition without a finger, for the week arrows.
 */
export function useHorizontalSwipe({
  onSwipe,
  canGoPrevious,
  canGoNext,
  contentKey,
  alsoSlide = [],
}: HorizontalSwipeOptions) {
  const reduceMotion = useReducedMotion();
  const { translateX, slidingIn, style, width } = useSlideTransition(contentKey);

  // Slides every moving view out, then swaps the content (`onSwipe`) while they wait off-screen on the far side.
  const slideOut = useMemo(
    () => (direction: SwipeDirection) => {
      'worklet';
      const away = direction === 'next' ? -width : width;
      for (const other of alsoSlide) {
        other.translateX.set(withTiming(away, { duration: swipeMotion.slideOutDuration }));
      }
      translateX.set(
        withTiming(away, { duration: swipeMotion.slideOutDuration }, (finished) => {
          if (!finished) return;
          slidingIn.set(true);
          translateX.set(-away);
          for (const other of alsoSlide) {
            other.slidingIn.set(true);
            other.translateX.set(-away);
          }
          scheduleOnRN(onSwipe, direction);
        }),
      );
    },
    [alsoSlide, onSwipe, slidingIn, translateX, width],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-swipeMotion.claimDistance, swipeMotion.claimDistance])
        .failOffsetY([-swipeMotion.verticalTolerance, swipeMotion.verticalTolerance])
        .onUpdate((event) => {
          if (reduceMotion) return;
          const allowed = event.translationX < 0 ? canGoNext : canGoPrevious;
          const offset = allowed ? event.translationX : event.translationX * swipeMotion.resistance;
          translateX.set(offset);
          for (const other of alsoSlide) other.translateX.set(offset);
        })
        .onEnd((event, success) => {
          const next = event.translationX < 0;
          const allowed = next ? canGoNext : canGoPrevious;
          const far = Math.abs(event.translationX) >= swipeMotion.commitDistance;
          const fast = Math.abs(event.velocityX) >= swipeMotion.commitVelocity;
          const direction: SwipeDirection = (far ? event.translationX : event.velocityX) < 0 ? 'next' : 'previous';
          const committed = success && allowed && (far || fast);
          if (!committed) {
            if (!reduceMotion) {
              translateX.set(withSpring(0, swipeMotion.spring));
              for (const other of alsoSlide) other.translateX.set(withSpring(0, swipeMotion.spring));
            }
            return;
          }
          if (reduceMotion) {
            scheduleOnRN(onSwipe, direction);
            return;
          }
          slideOut(direction);
        }),
    [alsoSlide, canGoNext, canGoPrevious, onSwipe, reduceMotion, slideOut, translateX],
  );

  /** The slide a committed swipe makes, started from JS (the week arrows). */
  const slide = (direction: SwipeDirection) => {
    if (reduceMotion) onSwipe(direction);
    else scheduleOnUI(slideOut, direction);
  };

  const transition = useMemo<SlideTransition>(() => ({ translateX, slidingIn }), [translateX, slidingIn]);

  return { gesture, style, slide, transition };
}
