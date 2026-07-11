import { useSyncExternalStore } from 'react';

/**
 * Shared `md` breakpoint query string (768px) used to keep JS-side viewport
 * checks (this hook, AppShell's resize-to-desktop auto-close) in sync with
 * each other. Deliberately NOT unified with the CSS `@media (max-width:
 * 767px)` rule in index.css that drives the drawer's off-canvas transform —
 * that's a separate concern and unifying it is out of scope (#729).
 */
export const MD_BREAKPOINT_QUERY = '(min-width: 768px)';

/**
 * Subscribes to a CSS media query via `matchMedia` and returns whether it
 * currently matches, re-rendering on viewport changes. Needed anywhere a
 * component has to make a JS-level decision based on viewport width — a CSS
 * media query alone can't toggle a DOM attribute like `inert` (#729).
 *
 * Built on `useSyncExternalStore` rather than a `useState` + `useEffect`
 * pair — an effect that calls `setState` synchronously on mount (to pick up
 * the current match before the first "change" event) trips the
 * `react-hooks/set-state-in-effect` lint rule (cascading-render risk). This
 * hook only ever reads/subscribes to matchMedia, which is exactly what
 * `useSyncExternalStore` is for.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
