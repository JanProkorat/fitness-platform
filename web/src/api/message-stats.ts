import api from '@/lib/api';
import type { WeeklyMessageStatsDto } from '@/api/generated';

// Re-export the generated type so consumers can import from this module unchanged.
export type { WeeklyMessageStatsDto };

/**
 * Fetch weekly coach/client message counts for a client's conversation.
 * Route: GET /trainer/clients/{clientId}/message-stats
 *
 * Always returns exactly `weeks` rows, oldest first, zero-filled for weeks
 * with no conversation activity (never a 404 for "no conversation yet").
 */
export async function getClientMessageStats(
  clientId: string,
  weeks = 4,
): Promise<WeeklyMessageStatsDto[]> {
  const { data } = await api.get<WeeklyMessageStatsDto[]>(
    `/trainer/clients/${clientId}/message-stats`,
    { params: { weeks } },
  );
  return data;
}
