import { api } from '@/api/client';
import type { GetClientAppConfigResponse } from '@/api/generated';

export type ClientAppConfig = GetClientAppConfigResponse;

export const APP_CONFIG_QUERY_KEY = ['client', 'app-config'] as const;

/** Server-controlled switches for the client app (GET /client/app-config, never cached by the server). */
export function fetchAppConfig(signal?: AbortSignal): Promise<ClientAppConfig> {
  return api.getClientAppConfigEndpoint(signal);
}
