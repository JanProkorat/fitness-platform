import { api } from '@/api/client';

export const MEASUREMENTS_QUERY_KEY = ['measurements'] as const;
export const WEIGHT_SERIES_QUERY_KEY = [...MEASUREMENTS_QUERY_KEY, 'weight-series'] as const;

/** Largest page the endpoint accepts; the list comes back newest first. */
const PAGE_SIZE = 100;
export const WEIGHT_SERIES_POINTS = 12;

/** The latest weights in kg, oldest first (GET /client/measurements); entries without a weight are skipped. */
export async function fetchWeightSeries(signal?: AbortSignal): Promise<number[]> {
  const response = await api.getMeasurementsEndpoint(1, PAGE_SIZE, undefined, undefined, signal);
  const weights: { at: number; kg: number }[] = [];
  for (const item of response.items ?? []) {
    const at = item.measuredAt ? Date.parse(item.measuredAt) : Number.NaN;
    if (item.weightKg !== undefined && Number.isFinite(item.weightKg) && !Number.isNaN(at)) {
      weights.push({ at, kg: item.weightKg });
    }
  }
  return weights
    .sort((a, b) => a.at - b.at)
    .slice(-WEIGHT_SERIES_POINTS)
    .map((entry) => entry.kg);
}
