import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { APP_CONFIG_QUERY_KEY, fetchAppConfig } from '@/api/appConfig';
import type { ClientAppConfig } from '@/api/appConfig';
import { useAuthStore } from '@/stores/auth';

export type PaymentsAvailability = {
  /** Whether payments may be shown on this platform right now. False until the server has said yes. */
  enabled: boolean;
  /** True once the server switch is known (answered or failed), so a screen can tell "not yet" from "no". */
  settled: boolean;
};

function flagFor(config: ClientAppConfig | undefined): boolean {
  if (Platform.OS === 'ios') return config?.showPaymentsOnIos === true;
  if (Platform.OS === 'android') return config?.showPaymentsOnAndroid === true;
  // Other platforms (Expo web) have no store rules to follow; only development builds may show payments.
  return __DEV__;
}

/**
 * The single place the server's payments switch is read. It fails closed: while the switch loads
 * or when loading it fails, payments stay hidden. Every payments entry point goes through this.
 */
export function usePaymentsEnabled(): PaymentsAvailability {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data, isPending } = useQuery({
    queryKey: APP_CONFIG_QUERY_KEY,
    queryFn: ({ signal }) => fetchAppConfig(signal),
    enabled: isAuthenticated,
    retry: 1,
  });

  return { enabled: flagFor(data) && data !== undefined, settled: !isPending };
}
