import { useEffect, type RefObject } from 'react';

// Exported so AppShell can locate a real focusable target inside the
// sidebar container without duplicating this selector (#729).
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus cycling within `containerRef` while `active` is
 * true. Lightweight, dependency-free — used by the mobile Sidebar drawer
 * (#585) instead of pulling in a focus-trap library for a single use case.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;

      // `container.contains(activeEl)` is true when activeEl IS the
      // container (Node.contains includes the node itself) — e.g. right
      // after open, Sidebar focuses the <aside> itself (tabIndex=-1, not
      // matched by FOCUSABLE_SELECTOR). Without an explicit check here,
      // Shift+Tab from that state falls through neither branch and the
      // browser's default backward-Tab escapes the trap (#729).
      if (e.shiftKey) {
        if (activeEl === first || activeEl === container || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, active]);
}
