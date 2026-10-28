import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { swipeMotion } from '@/theme/motion';

export type SwipeDirection = 'previous' | 'next';

/**
 * A horizontal pan for a view inside a vertical scroll: it activates only after a clear sideways move and
 * gives up on vertical drift, so scrolling keeps working. A swipe left means "next", right means "previous".
 * Callbacks run on the JS thread; attach the result to a `GestureDetector`.
 */
export function useHorizontalSwipe(onSwipe: (direction: SwipeDirection) => void) {
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-swipeMotion.claimDistance, swipeMotion.claimDistance])
        .failOffsetY([-swipeMotion.verticalTolerance, swipeMotion.verticalTolerance])
        .onEnd((event, success) => {
          if (!success) return;
          const far = Math.abs(event.translationX) >= swipeMotion.commitDistance;
          const fast = Math.abs(event.velocityX) >= swipeMotion.commitVelocity;
          if (!far && !fast) return;
          const delta = far ? event.translationX : event.velocityX;
          onSwipe(delta < 0 ? 'next' : 'previous');
        }),
    [onSwipe],
  );
}
