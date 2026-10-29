import { QueryCache, QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { isOfflineFailure } from '@/api/errors';
import { useConnectivityStore } from '@/stores/connectivity';

// React Native has no window focus: report the app returning to the foreground instead.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long cached data stays usable; the persisted snapshot uses the same window. */
export const CACHE_MAX_AGE_MS = 7 * DAY_MS;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (isOfflineFailure(error)) {
        useConnectivityStore.getState().markFailure();
      }
    },
    onSuccess: () => {
      useConnectivityStore.getState().markSuccess();
    },
  }),
  defaultOptions: {
    queries: {
      // Run the fetch even without a connection, so a failure shows the banner and cached data stays.
      networkMode: 'offlineFirst',
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});
