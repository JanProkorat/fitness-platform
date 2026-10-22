import { api } from '@/api/client';
import type { AddMeasurementRequest, MeasurementDto } from '@/api/generated';

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

export const MEASUREMENT_HISTORY_QUERY_KEY = [...MEASUREMENTS_QUERY_KEY, 'history'] as const;
export const PLAN_START_QUERY_KEY = [...MEASUREMENTS_QUERY_KEY, 'plan-start'] as const;

export type MeasurementEntry = MeasurementDto & {
  /** `measuredAt` as epoch milliseconds. */
  at: number;
};

/** Safety stop for the paging loop, far above any realistic history. */
const MAX_PAGES = 100;

/** Every measurement, newest first, paged at 100 until totalCount is reached (GET /client/measurements). */
export async function fetchMeasurementHistory(signal?: AbortSignal): Promise<MeasurementEntry[]> {
  const entries: MeasurementEntry[] = [];
  let received = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await api.getMeasurementsEndpoint(page, PAGE_SIZE, undefined, undefined, signal);
    const items = response.items ?? [];
    received += items.length;
    for (const item of items) {
      const at = item.measuredAt ? Date.parse(item.measuredAt) : Number.NaN;
      if (!Number.isNaN(at)) entries.push({ ...item, at });
    }
    if (items.length === 0 || received >= (response.totalCount ?? 0)) break;
  }
  return entries.sort((a, b) => b.at - a.at);
}

/** Epoch milliseconds of the earliest start date among Active plans, or null when none has one (GET /client/plans). */
export async function fetchPlanStart(signal?: AbortSignal): Promise<number | null> {
  const response = await api.getClientPlansEndpoint('Active', signal);
  let earliest: number | null = null;
  for (const plan of response.items ?? []) {
    const start = plan.startDate ? Date.parse(plan.startDate) : Number.NaN;
    if (plan.status === 'Active' && !Number.isNaN(start) && (earliest === null || start < earliest)) {
      earliest = start;
    }
  }
  return earliest;
}

/** Records one body measurement (POST /client/measurements). */
export function addMeasurement(request: AddMeasurementRequest): Promise<MeasurementDto> {
  return api.addMeasurementEndpoint(request);
}
