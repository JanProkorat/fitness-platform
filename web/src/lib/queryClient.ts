import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide React Query client. Exported as a module singleton so it can be
 * cleared from outside the React tree (the auth store) on session boundaries.
 *
 * SECURITY: this cache lives for the lifetime of the browser tab, independent
 * of auth state, and login/logout are client-side navigations (no full page
 * reload). Without an explicit clear on session change, one coach's cached
 * queries (client list, dashboards, messages) would be served to the next
 * coach who logs into the same tab — a cross-tenant data exposure that only a
 * browser restart (which destroys this in-memory singleton) would clear. The
 * auth store calls `queryClient.clear()` on both login and logout to guarantee
 * no prior session's data survives into a new one. See issue #769.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

// Refetch all queries when the app language changes so localized data
// (e.g. food names) updates.
window.addEventListener('app:languageChanged', () => {
  queryClient.invalidateQueries();
});
