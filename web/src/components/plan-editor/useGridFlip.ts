import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/** Length of the slide of a tile face from its old cell to its new one. */
export const FLIP_MS = 200;
const FLIP_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
/**
 * A request that no change picks up within this long is dropped, so it never animates an unrelated one. Generous on
 * purpose: the drag library runs its end handlers in a React transition, which can commit well after the handler.
 */
const REQUEST_TTL_MS = 2000;
/** Stacking above the neighbouring tiles while a face slides over them. */
const SLIDING_Z_INDEX = '20';

/** The face carrying `from` as its key is shown under `to` after the change. */
export interface FlipMove {
  from: string;
  to: string;
}

interface Request {
  moves: FlipMove[];
  rects: Map<string, DOMRect>;
}

function findFace(root: HTMLElement, key: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-flip-key="${key}"]`);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Slides tile faces from where they were to where they land (a FLIP animation, with the Web Animations API). It
 * only runs when asked: call the returned function right before the change that moves the faces, and the next
 * commit that carries the change plays it. Faces are found by their `data-flip-key`. Nothing plays for users who
 * prefer reduced motion.
 *
 * `content` and `preview` are what the change shows up in (the document, the drag preview). Only a commit in which
 * one of them changed plays the request: the drag library's end handlers run in a transition, so another commit
 * can land first, and playing then would slide faces whose contents have not moved yet.
 */
export function useGridFlip(root: HTMLElement | null, content: unknown, preview: unknown) {
  const requestRef = useRef<Request | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const flip = useCallback(
    (moves: readonly FlipMove[]) => {
      window.clearTimeout(timerRef.current);
      requestRef.current = null;
      if (!root || moves.length === 0 || prefersReducedMotion()) {
        return;
      }
      const rects = new Map<string, DOMRect>();
      for (const move of moves) {
        const face = findFace(root, move.from);
        if (face && !rects.has(move.from)) {
          // A face that is still sliding reports where it is drawn, so the next slide starts from there.
          rects.set(move.from, face.getBoundingClientRect());
        }
      }
      requestRef.current = { moves: [...moves], rects };
      timerRef.current = window.setTimeout(() => {
        requestRef.current = null;
      }, REQUEST_TTL_MS);
    },
    [root],
  );

  // Plays a pending request once, in the commit that carries the change, then forgets it.
  useLayoutEffect(() => {
    const request = requestRef.current;
    if (!request || !root) {
      return;
    }
    requestRef.current = null;
    window.clearTimeout(timerRef.current);
    const targets = request.moves.flatMap((move) => {
      const face = findFace(root, move.to);
      return face ? [{ move, face }] : [];
    });
    // Measure the settled layout, not a face that is still mid-slide.
    for (const { face } of targets) {
      face.getAnimations().forEach((animation) => animation.cancel());
    }
    for (const { move, face } of targets) {
      const before = request.rects.get(move.from);
      if (!before) {
        continue;
      }
      const after = face.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (dx === 0 && dy === 0) {
        continue;
      }
      face.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, zIndex: SLIDING_Z_INDEX },
          { transform: 'translate(0, 0)', zIndex: SLIDING_Z_INDEX },
        ],
        { duration: FLIP_MS, easing: FLIP_EASING },
      );
    }
  }, [root, content, preview]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return flip;
}
