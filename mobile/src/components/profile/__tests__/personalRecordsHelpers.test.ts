/**
 * Unit tests for personalRecordsHelpers.ts
 *
 * Weight formatter: whole number, decimal, zero-decimal, large number.
 * Date formatter: each breakpoint (today, yesterday, 2 days, week, 2 weeks,
 *                 3 weeks, month, 3 months) using a fixed reference date.
 */

import { formatWeight, formatRecordDate } from '../personalRecordsHelpers';

// ─── Weight formatter ─────────────────────────────────────────────────────────

describe('formatWeight', () => {
  it('formats a whole number without decimal (cs)', () => {
    expect(formatWeight(100, 'cs')).toBe('100 kg');
  });

  it('formats a decimal value with comma separator (cs)', () => {
    expect(formatWeight(82.5, 'cs')).toBe('82,5 kg');
  });

  it('formats a value with .0 fractional part without trailing zero (cs)', () => {
    // 80.0 should render as "80 kg" (minimumFractionDigits: 0)
    expect(formatWeight(80.0, 'cs')).toBe('80 kg');
  });

  it('formats a large number (cs)', () => {
    expect(formatWeight(200, 'cs')).toBe('200 kg');
  });

  it('formats a decimal value with dot separator (en)', () => {
    expect(formatWeight(82.5, 'en')).toBe('82.5 kg');
  });

  it('formats a decimal value with comma separator (de)', () => {
    expect(formatWeight(82.5, 'de')).toBe('82,5 kg');
  });

  it('formats a value with two decimal places (cs)', () => {
    expect(formatWeight(62.75, 'cs')).toBe('62,75 kg');
  });
});

// ─── Date formatter ───────────────────────────────────────────────────────────

// A simple stub for the t() function that returns distinguishable strings.
function makeT(locale: string) {
  return (key: string, opts?: Record<string, unknown>): string => {
    const suffix = opts ? JSON.stringify(opts) : '';
    return `[${locale}]${key}${suffix}`;
  };
}

describe('formatRecordDate', () => {
  // Fix "now" to a known date so all diffs are deterministic.
  const NOW = new Date('2026-04-18T12:00:00.000Z');

  function dateAgo(days: number): string {
    const d = new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }

  const t = makeT('cs');

  it('returns today key when achievedAt is the same day', () => {
    const result = formatRecordDate(NOW.toISOString(), t, NOW);
    expect(result).toBe('[cs]profile.records.dateToday');
  });

  it('returns yesterday key when 1 day ago', () => {
    const result = formatRecordDate(dateAgo(1), t, NOW);
    expect(result).toBe('[cs]profile.records.dateYesterday');
  });

  it('returns daysAgo key with count=2 for 2 days ago', () => {
    const result = formatRecordDate(dateAgo(2), t, NOW);
    expect(result).toBe('[cs]profile.records.dateDaysAgo{"count":2}');
  });

  it('returns daysAgo key with count=6 for 6 days ago', () => {
    const result = formatRecordDate(dateAgo(6), t, NOW);
    expect(result).toBe('[cs]profile.records.dateDaysAgo{"count":6}');
  });

  it('returns weekAgo key for 7 days ago', () => {
    const result = formatRecordDate(dateAgo(7), t, NOW);
    expect(result).toBe('[cs]profile.records.dateWeekAgo');
  });

  it('returns weekAgo key for 13 days ago', () => {
    const result = formatRecordDate(dateAgo(13), t, NOW);
    expect(result).toBe('[cs]profile.records.dateWeekAgo');
  });

  it('returns weeksAgo key with count=2 for 14 days ago', () => {
    const result = formatRecordDate(dateAgo(14), t, NOW);
    expect(result).toBe('[cs]profile.records.dateWeeksAgo{"count":2}');
  });

  it('returns weeksAgo key with count=3 for 21 days ago', () => {
    const result = formatRecordDate(dateAgo(21), t, NOW);
    expect(result).toBe('[cs]profile.records.dateWeeksAgo{"count":3}');
  });

  it('returns monthsAgo key with count=1 for 30 days ago', () => {
    const result = formatRecordDate(dateAgo(30), t, NOW);
    expect(result).toBe('[cs]profile.records.dateMonthsAgo{"count":1}');
  });

  it('returns monthsAgo key with count=3 for 90 days ago', () => {
    const result = formatRecordDate(dateAgo(90), t, NOW);
    expect(result).toBe('[cs]profile.records.dateMonthsAgo{"count":3}');
  });
});
