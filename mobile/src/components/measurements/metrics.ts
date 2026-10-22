import type { MeasurementEntry } from '@/api/measurements';

export type MetricKey = 'weight' | 'waist' | 'hips' | 'chest' | 'biceps' | 'thigh' | 'bodyFat';
export type MetricUnit = 'kg' | 'cm' | 'percent';
export type MetricField =
  | 'weightKg'
  | 'bodyFatPercentage'
  | 'chestCm'
  | 'waistCm'
  | 'hipsCm'
  | 'bicepsCm'
  | 'thighsCm';

export type Metric = { key: MetricKey; field: MetricField; unit: MetricUnit };

/** Display order of the list and of the circumference card in the sheet. */
export const METRICS: readonly Metric[] = [
  { key: 'weight', field: 'weightKg', unit: 'kg' },
  { key: 'waist', field: 'waistCm', unit: 'cm' },
  { key: 'hips', field: 'hipsCm', unit: 'cm' },
  { key: 'chest', field: 'chestCm', unit: 'cm' },
  { key: 'biceps', field: 'bicepsCm', unit: 'cm' },
  { key: 'thigh', field: 'thighsCm', unit: 'cm' },
  { key: 'bodyFat', field: 'bodyFatPercentage', unit: 'percent' },
];

export type Range = 'month' | 'plan' | 'all';

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Earliest timestamp (epoch ms) that still belongs to the range. */
export function rangeStart(range: Range, now: number, planStart: number | null): number {
  if (range === 'month') return now - MONTH_MS;
  if (range === 'plan') return planStart ?? 0;
  return 0;
}

/** The entry's value for a metric, or undefined when it was not recorded. */
export function valueOf(entry: MeasurementEntry, metric: Metric): number | undefined {
  const value = entry[metric.field];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

/** Newest recorded value of a metric over the whole history (entries are newest first). */
export function latestValue(entries: readonly MeasurementEntry[], metric: Metric): number | undefined {
  for (const entry of entries) {
    const value = valueOf(entry, metric);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Values of a metric recorded at or after `since`, oldest first. */
export function seriesSince(
  entries: readonly MeasurementEntry[],
  metric: Metric,
  since: number,
): number[] {
  const values: number[] = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const value = valueOf(entry, metric);
    if (entry.at >= since && value !== undefined) values.push(value);
  }
  return values;
}

/** Last value minus first value, or null below two points. */
export function seriesChange(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  return values[values.length - 1] - values[0];
}

export type ParsedInput =
  | { state: 'empty' }
  | { state: 'invalid' }
  | { state: 'ok'; value: number };

const DECIMAL_PATTERN = /^\d+([.,]\d*)?$/;

/** Reads a typed number; a comma counts as the decimal separator and zero is invalid. */
export function parseMetricInput(text: string): ParsedInput {
  const trimmed = text.trim();
  if (trimmed === '') return { state: 'empty' };
  if (!DECIMAL_PATTERN.test(trimmed)) return { state: 'invalid' };
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? { state: 'ok', value } : { state: 'invalid' };
}
