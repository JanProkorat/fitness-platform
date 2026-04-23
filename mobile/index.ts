// App entry — used in place of `expo-router/entry` directly so we can install
// a minimal SSR-context polyfill before any expo package module runs.
//
// Expo Router's web renderer pre-executes every module in a Node process before
// hydration. Some Expo packages (notably expo-notifications via its internal
// `ServerRegistrationModule.web.js`) reach for `localStorage.getItem` at import
// time. On Node that throws `TypeError: localStorage.getItem is not a function`
// and takes the whole bundle down, blocking every Playwright-driven QA run on
// expo-web.
//
// The polyfill installs a no-op Storage stub when no real `localStorage` exists.
// It runs before expo-router/entry is imported, so the dependency graph of
// every screen sees a valid `localStorage` object. On the real client there is
// already a browser `localStorage`, so the guard no-ops.

if (typeof globalThis.localStorage === 'undefined') {
  const noopStore = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (key: string): string | null => noopStore.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      noopStore.set(key, String(value));
    },
    removeItem: (key: string): void => {
      noopStore.delete(key);
    },
    clear: (): void => {
      noopStore.clear();
    },
    key: (index: number): string | null => {
      const keys = Array.from(noopStore.keys());
      return keys[index] ?? null;
    },
    get length(): number {
      return noopStore.size;
    },
  };
}

import 'expo-router/entry';
