import api from '@/lib/api';

/**
 * Profession values as serialized by the backend (JsonStringEnumConverter not applied
 * here — Profession is stored as a C# string property, always "Training" or "Nutrition").
 */
export type Profession = 'Training' | 'Nutrition';

/**
 * C# DayOfWeek convention: 0 = Sunday, 1 = Monday, …, 6 = Saturday.
 * Wire type is int.
 */
export type DayOfWeekInt = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * C# TimeSpan serializes to "HH:mm:ss" by System.Text.Json.
 * The backend enforces hour-aligned times (minutes/seconds = 0), so values will
 * always be of the form "HH:00:00".
 */
export type TimeSpanString = string; // e.g. "18:00:00"

/* ─────────────────────── GET /trainer/weekly-check-ins/settings ─────────────────── */

/** DTO for a single weekly check-in setting (mirrors CheckInSettingDto in backend). */
export interface CheckInSettingDto {
  id: string; // Guid
  profession: Profession;
  /** 0 = Sunday, 1 = Monday, …, 6 = Saturday */
  dayOfWeek: DayOfWeekInt;
  /** "HH:mm:ss", always hour-aligned */
  timeOfDay: TimeSpanString;
  enabled: boolean;
  defaultAddendum: string | null;
}

/** Response wrapper for GET /trainer/weekly-check-ins/settings. */
export interface GetSettingsResponse {
  settings: CheckInSettingDto[];
}

/** GET /trainer/weekly-check-ins/settings */
export async function getCheckInSettings(): Promise<GetSettingsResponse> {
  const { data } = await api.get<GetSettingsResponse>('/trainer/weekly-check-ins/settings');
  return data;
}

/* ─────────────────────── PUT /trainer/weekly-check-ins/settings ─────────────────── */

/** Request body for PUT /trainer/weekly-check-ins/settings (mirrors PutSettingsRequest). */
export interface PutSettingsRequest {
  profession: Profession;
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: DayOfWeekInt;
  /** "HH:mm:ss" — must be hour-aligned */
  timeOfDay: TimeSpanString;
  enabled: boolean;
  defaultAddendum: string | null;
}

/** Response for PUT /trainer/weekly-check-ins/settings (mirrors PutSettingsResponse). */
export interface PutSettingsResponse {
  id: string; // Guid
  profession: Profession;
  dayOfWeek: DayOfWeekInt;
  timeOfDay: TimeSpanString;
  enabled: boolean;
  defaultAddendum: string | null;
}

/** PUT /trainer/weekly-check-ins/settings */
export async function upsertCheckInSetting(
  request: PutSettingsRequest,
): Promise<PutSettingsResponse> {
  const { data } = await api.put<PutSettingsResponse>(
    '/trainer/weekly-check-ins/settings',
    request,
  );
  return data;
}

/* ─────────────────────── GET /trainer/weekly-check-ins/overrides ────────────────── */

/**
 * DTO for a single per-client override (mirrors CheckInOverrideDto in backend).
 * Null fields mean "inherit from the trainer's default setting".
 * There are NO computed effective fields — the UI must merge override + setting client-side.
 */
export interface CheckInOverrideDto {
  id: string; // Guid
  clientUserId: string; // Guid
  clientFirstName: string;
  clientLastName: string;
  profession: Profession;
  /** Null = inherit day from setting */
  dayOfWeek: DayOfWeekInt | null;
  /** Null = inherit time from setting */
  timeOfDay: TimeSpanString | null;
  /** Null = inherit enabled flag from setting */
  enabled: boolean | null;
  /** Null = inherit addendum from setting */
  addendum: string | null;
}

/** Response wrapper for GET /trainer/weekly-check-ins/overrides. */
export interface GetOverridesResponse {
  overrides: CheckInOverrideDto[];
}

/** GET /trainer/weekly-check-ins/overrides */
export async function getCheckInOverrides(): Promise<GetOverridesResponse> {
  const { data } = await api.get<GetOverridesResponse>('/trainer/weekly-check-ins/overrides');
  return data;
}

/* ─────────────────────── PUT /trainer/weekly-check-ins/overrides/{id}/{profession} ─ */

/** Request body for PUT /trainer/weekly-check-ins/overrides/{clientUserId}/{profession}. */
export interface PutOverrideRequest {
  /** Null = inherit */
  dayOfWeek: DayOfWeekInt | null;
  /** "HH:mm:ss" — must be hour-aligned. Null = inherit. */
  timeOfDay: TimeSpanString | null;
  /** Null = inherit */
  enabled: boolean | null;
  /** Null = inherit */
  addendum: string | null;
}

/** Response for PUT /trainer/weekly-check-ins/overrides (mirrors PutOverrideResponse). */
export interface PutOverrideResponse {
  id: string;
  clientUserId: string;
  profession: Profession;
  dayOfWeek: DayOfWeekInt | null;
  timeOfDay: TimeSpanString | null;
  enabled: boolean | null;
  addendum: string | null;
}

/** PUT /trainer/weekly-check-ins/overrides/{clientUserId}/{profession} */
export async function upsertCheckInOverride(
  clientUserId: string,
  profession: Profession,
  request: PutOverrideRequest,
): Promise<PutOverrideResponse> {
  const { data } = await api.put<PutOverrideResponse>(
    `/trainer/weekly-check-ins/overrides/${clientUserId}/${profession}`,
    request,
  );
  return data;
}

/* ─────────────────────── DELETE /trainer/weekly-check-ins/overrides/{id}/{profession} */

/** DELETE /trainer/weekly-check-ins/overrides/{clientUserId}/{profession} */
export async function deleteCheckInOverride(
  clientUserId: string,
  profession: Profession,
): Promise<void> {
  await api.delete(`/trainer/weekly-check-ins/overrides/${clientUserId}/${profession}`);
}

/* ─────────────────────── UI helpers ────────────────────────────────────────────── */

/**
 * Maps a C# DayOfWeek int (0=Sunday…6=Saturday) to an i18n key suffix.
 * Used at the UI boundary to convert wire ints to localized display strings.
 */
export const DAY_OF_WEEK_KEYS: Record<DayOfWeekInt, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

/**
 * The full ordered list of DayOfWeekInt values for dropdowns.
 * Ordered Monday→Sunday to match European locale expectations.
 */
export const ORDERED_DAYS: DayOfWeekInt[] = [1, 2, 3, 4, 5, 6, 0];

/**
 * Parses a "HH:mm:ss" TimeSpan string and returns just the "HH:mm" display portion.
 */
export function formatTimeDisplay(timeSpan: TimeSpanString): string {
  return timeSpan.substring(0, 5); // "18:00:00" → "18:00"
}

/**
 * Converts an "HH:mm" UI display value to "HH:mm:ss" wire format required by the backend.
 */
export function toTimeSpanString(hourMinute: string): TimeSpanString {
  return `${hourMinute}:00`; // "18:00" → "18:00:00"
}
