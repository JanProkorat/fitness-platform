import { useState } from 'react';

/**
 * True once `value` has changed since the first render, so an enter animation
 * can play on a swap but not on the initial mount.
 */
export function useChanged(value: string): boolean {
  const [previous, setPrevious] = useState(value);
  const [changed, setChanged] = useState(false);

  if (previous !== value) {
    setPrevious(value);
    setChanged(true);
  }

  return changed;
}
