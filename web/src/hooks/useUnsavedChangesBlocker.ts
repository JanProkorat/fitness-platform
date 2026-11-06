import { useCallback, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router-dom';

interface UnsavedChangesBlocker {
  blocker: Blocker;
  /** Runs `navigate` with the guard off, for a navigation that discards or has already persisted the edits. */
  leaveWithoutPrompt: (navigate: () => void) => void;
}

/**
 * Blocks in-app navigation to another page while `when` is true. Changes that
 * keep the same pathname are never blocked. Needs a data router (see App.tsx).
 * Reload and tab close are not covered; pair with a `beforeunload` listener.
 */
export function useUnsavedChangesBlocker(when: boolean): UnsavedChangesBlocker {
  const bypass = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !bypass.current && when && currentLocation.pathname !== nextLocation.pathname,
  );
  // The router asks the blocker synchronously inside navigate(), so a flag held for the call is enough.
  const leaveWithoutPrompt = useCallback((navigate: () => void) => {
    bypass.current = true;
    try {
      navigate();
    } finally {
      bypass.current = false;
    }
  }, []);
  return { blocker, leaveWithoutPrompt };
}
