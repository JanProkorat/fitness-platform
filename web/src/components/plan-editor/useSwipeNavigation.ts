import { useEffect, useRef } from 'react';
import type { SlideDirection } from '@/components/plan-editor/useSlideTransition';

/** Horizontal travel that counts as one step. */
export const SWIPE_THRESHOLD_PX = 80;
/** After a step, wheel events keep being ignored until this long passes without one (trackpad momentum). */
const WHEEL_IDLE_MS = 200;
/** Touch movement needed before the gesture is judged horizontal or vertical. */
const TOUCH_DECIDE_PX = 10;

/** True when an ancestor below `root` scrolls horizontally and can still move in the gesture's direction. */
function scrollableAncestorCanMove(target: EventTarget | null, root: HTMLElement, contentDx: number): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== root) {
    if (node instanceof HTMLElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth) {
        const atStart = node.scrollLeft <= 0;
        const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
        if ((contentDx < 0 && !atStart) || (contentDx > 0 && !atEnd)) {
          return true;
        }
      }
    }
    node = node.parentElement;
  }
  return false;
}

function isTextEntry(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input, textarea, select, [contenteditable]') !== null;
}

/**
 * Turns a horizontal trackpad scroll or a touch swipe on `element` into one `onSwipe` step per
 * gesture. Mouse input is ignored. The native listeners are non-passive so a horizontal gesture can
 * be stopped from triggering the browser's back/forward swipe.
 */
export function useSwipeNavigation(
  element: HTMLElement | null,
  onSwipe: (direction: SlideDirection) => void,
  isBlocked: () => boolean,
) {
  const swipeRef = useRef(onSwipe);
  const blockedRef = useRef(isBlocked);
  useEffect(() => {
    swipeRef.current = onSwipe;
    blockedRef.current = isBlocked;
  });

  useEffect(() => {
    if (!element) {
      return;
    }

    let wheelAccumulated = 0;
    let wheelLocked = false;
    let lastWheelAt = 0;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      if (scrollableAncestorCanMove(event.target, element, event.deltaX)) {
        return;
      }
      event.preventDefault();
      const now = event.timeStamp;
      if (now - lastWheelAt > WHEEL_IDLE_MS) {
        wheelLocked = false;
        wheelAccumulated = 0;
      }
      lastWheelAt = now;
      if (wheelLocked || blockedRef.current()) {
        return;
      }
      wheelAccumulated += event.deltaX;
      if (Math.abs(wheelAccumulated) >= SWIPE_THRESHOLD_PX) {
        const direction: SlideDirection = wheelAccumulated > 0 ? 'next' : 'prev';
        wheelLocked = true;
        wheelAccumulated = 0;
        swipeRef.current(direction);
      }
    };

    let touch: { id: number; x: number; y: number; axis: 'x' | 'y' | null; done: boolean; startTarget: EventTarget | null } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !event.isPrimary || isTextEntry(event.target)) {
        touch = null;
        return;
      }
      touch = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, done: false, startTarget: event.target };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!touch || touch.id !== event.pointerId || touch.done || touch.axis === 'y') {
        return;
      }
      const dx = event.clientX - touch.x;
      const dy = event.clientY - touch.y;
      if (touch.axis === null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < TOUCH_DECIDE_PX) {
          return;
        }
        touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (touch.axis === 'y') {
          return;
        }
      }
      if (blockedRef.current() || Math.abs(dx) < SWIPE_THRESHOLD_PX) {
        return;
      }
      touch.done = true;
      // A finger moving right drags the content right, so the scroll position it needs is -dx.
      if (scrollableAncestorCanMove(touch.startTarget, element, -dx)) {
        return;
      }
      swipeRef.current(dx < 0 ? 'next' : 'prev');
    };

    const endTouch = (event: PointerEvent) => {
      if (touch?.id === event.pointerId) {
        touch = null;
      }
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('pointerdown', onPointerDown, { passive: true });
    element.addEventListener('pointermove', onPointerMove, { passive: true });
    element.addEventListener('pointerup', endTouch, { passive: true });
    element.addEventListener('pointercancel', endTouch, { passive: true });
    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', endTouch);
      element.removeEventListener('pointercancel', endTouch);
    };
  }, [element]);
}
