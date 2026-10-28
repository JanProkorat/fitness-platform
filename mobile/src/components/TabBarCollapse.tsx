import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { tabBarCollapseMotion } from '@/theme/motion';

type TabBarCollapseValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
};

const TabBarCollapseContext = createContext<TabBarCollapseValue | null>(null);

/** Shares whether the bottom tab bar is collapsed to a pill between the tab bar and the tab screens. */
export function TabBarCollapseProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const value = useMemo(() => ({ collapsed, setCollapsed }), [collapsed]);
  return <TabBarCollapseContext.Provider value={value}>{children}</TabBarCollapseContext.Provider>;
}

export function useTabBarCollapse(): TabBarCollapseValue | null {
  return useContext(TabBarCollapseContext);
}

/**
 * Scroll handler that collapses the tab bar when scrolling down and expands it when scrolling up.
 * Pull-to-refresh overscroll (negative offset) and the bottom bounce are ignored.
 */
export function useTabBarScrollHandler(): (event: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const context = useTabBarCollapse();
  const setCollapsed = context?.setCollapsed;
  const anchor = useRef(0);

  return useCallback(
    (event) => {
      if (!setCollapsed) return;
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const y = contentOffset.y;
      const maxY = contentSize.height - layoutMeasurement.height;
      if (y < 0 || y > maxY) return;
      const delta = y - anchor.current;
      if (y === 0) {
        anchor.current = 0;
        setCollapsed(false);
      } else if (delta > tabBarCollapseMotion.scrollThreshold) {
        anchor.current = y;
        setCollapsed(true);
      } else if (delta < -tabBarCollapseMotion.scrollThreshold) {
        anchor.current = y;
        setCollapsed(false);
      }
    },
    [setCollapsed],
  );
}
