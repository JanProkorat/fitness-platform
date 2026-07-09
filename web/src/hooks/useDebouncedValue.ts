import { useState, useEffect, useRef, useLayoutEffect } from 'react';

/**
 * Returns a debounced copy of `value`.
 * The debounced value updates `delay` ms after the last change.
 * Optionally calls `onDebounce` when the value settles (e.g. to reset page).
 *
 * `onDebounce` is read via a ref (not a `useEffect` dependency) so that
 * callers passing an inline arrow function don't reset the timer on every
 * render — only `value`/`delay` changes restart the debounce window.
 */
export function useDebouncedValue<T>(value: T, delay = 300, onDebounce?: () => void): T {
  const [debounced, setDebounced] = useState(value);
  const onDebounceRef = useRef(onDebounce);
  useLayoutEffect(() => {
    onDebounceRef.current = onDebounce;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
      onDebounceRef.current?.();
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
