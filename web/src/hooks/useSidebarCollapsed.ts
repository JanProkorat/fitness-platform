import { useCallback, useState } from 'react';

export const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Storage unavailable (private mode, quota): the choice just isn't remembered.
  }
}

/** Collapsed/expanded state of the app sidebar: one choice, remembered per browser, used on every route. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readStored);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
    writeStored(!collapsed);
  }, [collapsed]);

  return { collapsed, toggle };
}
