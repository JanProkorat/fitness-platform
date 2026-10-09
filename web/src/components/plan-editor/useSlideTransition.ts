import { useCallback, useEffect, useRef, useState } from 'react';

export type SlideDirection = 'next' | 'prev';

/** Matches the slide keyframes in index.css. */
export const SLIDE_MS = 200;

export interface SlideState {
  direction: SlideDirection;
  /** Changes on every slide so the content remounts and the animation restarts, even mid-slide. */
  key: number;
}

/**
 * Tracks the slide-in of the editor content after a week or day change. Nothing is scheduled for
 * users who prefer reduced motion, so their change is instant.
 */
export function useSlideTransition() {
  const [slide, setSlide] = useState<SlideState | null>(null);
  const activeRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const start = useCallback((direction: SlideDirection) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    activeRef.current = true;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      activeRef.current = false;
    }, SLIDE_MS);
    setSlide((previous) => ({ direction, key: (previous?.key ?? 0) + 1 }));
  }, []);

  const isSliding = useCallback(() => activeRef.current, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { slide, start, isSliding };
}
