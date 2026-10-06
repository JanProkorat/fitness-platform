import type { MouseEvent } from 'react';

/**
 * Smooth-scrolls to the element with the given id (instant under reduced motion), keeps the hash
 * in the address bar without a jump, and moves focus to it. Returns false for an unknown id.
 */
export function scrollToId(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) {
    return false;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', `#${id}`);
  target.focus({ preventScroll: true });
  return true;
}

/**
 * Click handler for in-page `<a href="#id">` links on the landing page. Modified
 * clicks and unknown targets fall through to the browser's default.
 */
export function scrollToAnchor(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const hash = event.currentTarget.hash;
  if (hash.length > 1 && scrollToId(decodeURIComponent(hash.slice(1)))) {
    event.preventDefault();
  }
}
