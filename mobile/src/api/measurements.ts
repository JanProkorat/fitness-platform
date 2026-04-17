import api from './client';
import type {
  MeasurementDto,
  AddMeasurementRequest,
  GetMeasurementsResponse,
  MeasurementStatsResponse,
} from './generated';

// Re-export generated types so consumer imports (`from '@/api/measurements'`) still work.
export type { MeasurementDto, AddMeasurementRequest, GetMeasurementsResponse, MeasurementStatsResponse };

export async function addMeasurement(request: AddMeasurementRequest): Promise<MeasurementDto> {
  const { data } = await api.post<MeasurementDto>('/client/measurements', request);
  return data;
}

export async function getMeasurements(params?: {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<GetMeasurementsResponse> {
  const { data } = await api.get<GetMeasurementsResponse>('/client/measurements', { params });
  return data;
}

export async function getLatestMeasurement(): Promise<MeasurementDto> {
  const { data } = await api.get<MeasurementDto>('/client/measurements/latest');
  return data;
}

export async function getMeasurementStats(): Promise<MeasurementStatsResponse> {
  const { data } = await api.get<MeasurementStatsResponse>('/client/measurements/stats');
  return data;
}
