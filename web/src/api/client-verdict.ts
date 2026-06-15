import api from '@/lib/api';
import type { GetClientVerdictResponse } from '@/api/generated';
export { ClientVerdict, WeightDirection } from '@/api/generated';
export type { GetClientVerdictResponse };

/** Fetch the on-track verdict for a client. */
export async function getClientVerdict(
  clientId: string,
): Promise<GetClientVerdictResponse> {
  const { data } = await api.get<GetClientVerdictResponse>(
    `/trainer/clients/${clientId}/verdict`,
  );
  return data;
}
