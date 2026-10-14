import { useCallback, useState } from 'react';

export type ViewMode = 'grid' | 'list';

export const RECIPES_VIEW_MODE_KEY = 'recipes-view-mode';
export const INGREDIENTS_VIEW_MODE_KEY = 'ingredients-view-mode';

function readStored(key: string, fallback: ViewMode): ViewMode {
  try {
    const value = window.localStorage.getItem(key);
    return value === 'grid' || value === 'list' ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, mode: ViewMode): void {
  try {
    window.localStorage.setItem(key, mode);
  } catch {
    // Storage unavailable (private mode, quota): the choice just isn't remembered.
  }
}

/** Grid/list choice of one library page, remembered per browser under its own storage key. */
export function useViewMode(storageKey: string, defaultMode: ViewMode) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => readStored(storageKey, defaultMode));

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      writeStored(storageKey, mode);
    },
    [storageKey],
  );

  return { viewMode, setViewMode };
}
