import api from '@/lib/api';
import type { GetMeasurementsResponse, MeasurementDto } from '@/api/generated';

/**
 * Fetch body measurements for a trainer's client.
 * Wraps GET /trainer/clients/{clientId}/measurements (read-only trainer endpoint).
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

/**
 * Request body for a trainer manually recording a body measurement for a client.
 * At least one measurement value must be provided (enforced server-side and by
 * the calling form's Zod schema).
 */
export interface CreateClientMeasurementRequest {
  /** ISO 8601 datetime — must not be in the future. */
  measuredAt: string;
  weightKg?: number;
  bodyFatPercentage?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  bicepsCm?: number;
  thighsCm?: number;
  /** Max 500 characters. */
  notes?: string;
}

/**
 * Trainer manually records a body measurement for a client.
 * Wraps POST /trainer/clients/{clientId}/measurements. Hand-written (not part
 * of generated.ts yet) — see CreateClientMeasurementRequest for the request
 * shape; the response reuses the generated MeasurementDto.
 */
export async function createClientMeasurement(
  clientId: string,
  body: CreateClientMeasurementRequest,
): Promise<MeasurementDto> {
  const { data } = await api.post<MeasurementDto>(
    `/trainer/clients/${clientId}/measurements`,
    body,
  );
  return data;
}
