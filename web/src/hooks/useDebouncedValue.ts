import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value`.
 * The debounced value updates `delay` ms after the last change.
 * Optionally calls `onDebounce` when the value settles (e.g. to reset page).
 */
export function useDebouncedValue<T>(value: T, delay = 300, onDebounce?: () => void): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
      onDebounce?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
