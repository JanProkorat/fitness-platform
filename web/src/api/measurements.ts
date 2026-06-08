import api from '@/lib/api';
import type { GetMeasurementsResponse } from '@/api/generated';

/**
 * Fetch body measurements for a trainer's client.
 * Wraps GET /trainer/clients/{clientId}/measurements (read-only trainer endpoint).
 *
 * Note: there is no trainer add-measurement endpoint — only clients can POST /client/measurements.
 * A trainer add-measurement flow is tracked as a future backend+web issue.
 */
export async function getClientMeasurements(
  clientId: string,
  page = 1,
  pageSize = 50,
): Promise<GetMeasurementsResponse> {
  const { data } = await api.get<GetMeasurementsResponse>(
    `/trainer/clients/${clientId}/measurements`,
    { params: { page, pageSize } },
  );
  return data;
}
