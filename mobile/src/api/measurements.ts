import api from './client';

export interface MeasurementDto {
  measurementId: string;
  measuredAt: string;
  weightKg?: number | null;
  bodyFatPercentage?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  bicepsCm?: number | null;
  thighsCm?: number | null;
  notes?: string | null;
}

export interface AddMeasurementRequest {
  measuredAt: string;
  weightKg?: number;
  bodyFatPercentage?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  bicepsCm?: number;
  thighsCm?: number;
  notes?: string;
}

export interface GetMeasurementsResponse {
  items: MeasurementDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface MeasurementStatsResponse {
  minWeight?: number | null;
  maxWeight?: number | null;
  avgWeight?: number | null;
  latestWeight?: number | null;
  weightChange30Days?: number | null;
  totalCount: number;
}

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
