import { createContext, useContext } from 'react';

/** The editor's scrolling content area; popovers stay inside it so they never cover the fixed header. */
export const PopoverBoundaryContext = createContext<HTMLElement | null>(null);

/** Radix `collisionBoundary` for popovers opened from the content area. */
export function usePopoverBoundary(): HTMLElement[] | undefined {
  const element = useContext(PopoverBoundaryContext);
  return element ? [element] : undefined;
}
