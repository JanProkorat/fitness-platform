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

/**
 * Collapsed/expanded state of the app sidebar. The choice is remembered per
 * browser. A `forceCollapsed` route (the plan template editor) always opens
 * collapsed; toggling there lasts for that visit and never overwrites the
 * stored choice.
 */
export function useSidebarCollapsed(forceCollapsed: boolean) {
  const [stored, setStored] = useState(readStored);
  const [visitOverride, setVisitOverride] = useState<boolean | null>(null);
  const [prevForce, setPrevForce] = useState(forceCollapsed);

  if (prevForce !== forceCollapsed) {
    setPrevForce(forceCollapsed);
    setVisitOverride(null);
  }

  const collapsed = forceCollapsed ? (visitOverride ?? true) : stored;

  const toggle = useCallback(() => {
    if (forceCollapsed) {
      setVisitOverride(!collapsed);
      return;
    }
    setStored(!collapsed);
    writeStored(!collapsed);
  }, [forceCollapsed, collapsed]);

  return { collapsed, toggle };
}
