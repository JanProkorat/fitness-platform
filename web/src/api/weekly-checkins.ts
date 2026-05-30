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

/* ─────────────────────── WeeklyCheckInStatus ────────────────────────────────────── */

/**
 * Mirrors the C# WeeklyCheckInStatus enum (added in #331).
 * Values are serialized as strings by the backend (JsonStringEnumConverter).
 */
export type WeeklyCheckInStatus =
  | 'Pending'
  | 'Responded'
  | 'Dismissed'
  | 'Reviewed'
  | 'Expired';

/**
 * Allowed values for the deadlineOffsetHours setting field.
 * Validated server-side (FluentValidation) and client-side (Zod) with this set.
 */
export const DEADLINE_OFFSET_OPTIONS = [24, 48, 72, 120, 168] as const;
export type DeadlineOffsetHours = (typeof DEADLINE_OFFSET_OPTIONS)[number];

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
  /**
   * How many hours after sending the check-in expires.
   * Allowed values: 24, 48, 72, 120, 168. Default: 72 (3 days).
   * Added in #331.
   */
  deadlineOffsetHours: DeadlineOffsetHours;
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
  /** Allowed: 24 | 48 | 72 | 120 | 168. Added in #331. */
  deadlineOffsetHours: DeadlineOffsetHours;
}

/** Response for PUT /trainer/weekly-check-ins/settings (mirrors PutSettingsResponse). */
export interface PutSettingsResponse {
  id: string; // Guid
  profession: Profession;
  dayOfWeek: DayOfWeekInt;
  timeOfDay: TimeSpanString;
  enabled: boolean;
  defaultAddendum: string | null;
  /** Added in #331. */
  deadlineOffsetHours: DeadlineOffsetHours;
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
  /**
   * Null = inherit deadline from trainer's default setting.
   * When set, overrides the deadline for this client only.
   * Allowed values: 24 | 48 | 72 | 120 | 168. Added in #358.
   */
  deadlineOffsetHours: DeadlineOffsetHours | null;
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
  /**
   * Null = clear the override and inherit deadline from the trainer's default setting.
   * Allowed values: 24 | 48 | 72 | 120 | 168. Added in #358.
   */
  deadlineOffsetHours: DeadlineOffsetHours | null;
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
  /** Added in #358. Null = inherits from trainer's default setting. */
  deadlineOffsetHours: DeadlineOffsetHours | null;
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

/* ─────────────────────── CheckInFlag ───────────────────────────────────────────── */

/**
 * Mirrors the C# CheckInFlag enum.
 * Values are serialized as strings by the backend (JsonStringEnumConverter).
 */
export type CheckInFlag =
  | 'Traveling'
  | 'EventOrCelebration'
  | 'SickOrLowEnergy'
  | 'InjuryOrPain'
  | 'MoreTimeAvailable'
  | 'LessTimeAvailable';

/* ─────────────────────── GET /trainer/weekly-check-ins?weekStartDate=... ────────── */

/**
 * One check-in row as returned for the trainer's Today card.
 * Mirrors TrainerCheckInDto in GetTrainerCheckInsResponse.cs.
 */
export interface TrainerCheckInDto {
  id: string; // Guid
  clientUserId: string; // Guid
  clientName: string;
  /** "Training" | "Nutrition" */
  profession: Profession;
  /** ISO date string — the Monday of the planned week */
  weekStartDate: string;
  flags: CheckInFlag[];
  note: string | null;
  sentAt: string; // ISO datetime
  respondedAt: string | null;
  dismissedByClientAt: string | null;
  reviewedByTrainerAt: string | null;
  /** Added in #331 — lifecycle status derived from the Status column. */
  status: WeeklyCheckInStatus;
  /** Added in #331 — UTC datetime at which the check-in expires. Null when no deadline configured. */
  dueAt: string | null;
}

/** Response wrapper for GET /trainer/weekly-check-ins. */
export interface GetTrainerCheckInsResponse {
  checkIns: TrainerCheckInDto[];
}

/** GET /trainer/weekly-check-ins?weekStartDate=YYYY-MM-DD */
export async function getTrainerCheckIns(
  weekStartDate: string,
): Promise<GetTrainerCheckInsResponse> {
  const { data } = await api.get<GetTrainerCheckInsResponse>('/trainer/weekly-check-ins', {
    params: { weekStartDate },
  });
  return data;
}

/* ─────────────────────── GET /trainer/weekly-check-ins/{id} ─────────────────────── */

/**
 * Detail check-in DTO.
 * Mirrors GetCheckInDetailResponse.cs.
 */
export interface CheckInDetailDto {
  id: string;
  clientUserId: string;
  clientName: string;
  professionalUserId: string;
  profession: Profession;
  weekStartDate: string;
  flags: CheckInFlag[];
  note: string | null;
  sentAt: string;
  respondedAt: string | null;
  dismissedByClientAt: string | null;
  reviewedByTrainerAt: string | null;
  /** Added in #331 — lifecycle status. */
  status: WeeklyCheckInStatus;
  /** Added in #331 — deadline UTC datetime; null if no deadline. */
  dueAt: string | null;
}

/** GET /trainer/weekly-check-ins/{id} */
export async function getCheckInDetail(id: string): Promise<CheckInDetailDto> {
  const { data } = await api.get<CheckInDetailDto>(`/trainer/weekly-check-ins/${id}`);
  return data;
}

/* ─────────────────────── POST /trainer/weekly-check-ins/{id}/mark-reviewed ─────── */

/** Response for POST /trainer/weekly-check-ins/{id}/mark-reviewed. */
export interface MarkCheckInReviewedResponse {
  id: string;
  reviewedAt: string; // ISO datetime (UTC)
}

/** POST /trainer/weekly-check-ins/{id}/mark-reviewed */
export async function markCheckInReviewed(id: string): Promise<MarkCheckInReviewedResponse> {
  const { data } = await api.post<MarkCheckInReviewedResponse>(
    `/trainer/weekly-check-ins/${id}/mark-reviewed`,
  );
  return data;
}

/* ─────────────────────── GET /trainer/clients/{clientUserId}/weekly-check-ins/current ─ */

/**
 * A single check-in as seen from the plan-editor banner.
 * Mirrors ClientCheckInDto in GetClientCurrentCheckInResponse.cs.
 */
export interface ClientCheckInDto {
  id: string;
  profession: Profession;
  weekStartDate: string;
  flags: CheckInFlag[];
  note: string | null;
  sentAt: string;
  respondedAt: string | null;
  dismissedByClientAt: string | null;
  reviewedByTrainerAt: string | null;
}

/** Response wrapper for GET /trainer/clients/{clientUserId}/weekly-check-ins/current. */
export interface GetClientCurrentCheckInResponse {
  checkIns: ClientCheckInDto[];
}

/**
 * GET /trainer/clients/{clientUserId}/weekly-check-ins/current
 * @param clientUserId - Client's ApplicationUser Id (Guid string)
 * @param profession   - Optional: "Training" | "Nutrition". Omit to get all professions.
 */
export async function getClientCurrentCheckIn(
  clientUserId: string,
  profession?: Profession,
): Promise<GetClientCurrentCheckInResponse> {
  const { data } = await api.get<GetClientCurrentCheckInResponse>(
    `/trainer/clients/${clientUserId}/weekly-check-ins/current`,
    { params: profession ? { profession } : {} },
  );
  return data;
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
