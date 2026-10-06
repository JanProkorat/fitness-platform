import type { MouseEvent } from 'react';

/**
 * Click handler for in-page `<a href="#id">` links on the landing page:
 * smooth-scrolls to the target (instant under reduced motion), keeps the hash
 * in the address bar without a jump, and moves focus to the section. Modified
 * clicks and unknown targets fall through to the browser's default.
 */
export function scrollToAnchor(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const hash = event.currentTarget.hash;
  const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (!target) {
    return;
  }

  event.preventDefault();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', hash);
  target.focus({ preventScroll: true });
}
