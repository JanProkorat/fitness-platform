import { useBlocker, type Blocker } from 'react-router-dom';

/**
 * Blocks in-app navigation to another page while `when` is true. Changes that
 * keep the same pathname are never blocked. Needs a data router (see App.tsx).
 * Reload and tab close are not covered; pair with a `beforeunload` listener.
 */
export function useUnsavedChangesBlocker(when: boolean): Blocker {
  return useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );
}
