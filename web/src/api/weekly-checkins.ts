import api from '@/lib/api';

/** Enum values matching backend Profession enum */
export type Profession = 'Training' | 'Nutrition';

/** Enum values matching backend DayOfWeek enum */
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

/** Trainer-level default setting per profession */
export interface WeeklyCheckInSetting {
  profession: Profession;
  dayOfWeek: DayOfWeek;
  /** Hour string in "HH:00" format, e.g. "09:00" */
  timeOfDay: string;
  enabled: boolean;
  defaultAddendum: string | null;
}

/** Per-client override row returned in the overrides list */
export interface WeeklyCheckInOverride {
  clientUserId: string;
  clientFirstName: string;
  clientLastName: string;
  clientAvatarUrl: string | null;
  profession: Profession;
  /** null means "use default" */
  dayOfWeek: DayOfWeek | null;
  /** null means "use default" */
  timeOfDay: string | null;
  /** null means "use default" */
  enabled: boolean | null;
  /** null means "use default" */
  addendum: string | null;
  /** Resolved effective values from the setting + override */
  effectiveDayOfWeek: DayOfWeek;
  effectiveTimeOfDay: string;
  effectiveEnabled: boolean;
}

export interface UpsertWeeklyCheckInSettingRequest {
  profession: Profession;
  dayOfWeek: DayOfWeek;
  /** "HH:00:00" or "HH:00" */
  timeOfDay: string;
  enabled: boolean;
  defaultAddendum: string | null;
}

export interface UpsertWeeklyCheckInOverrideRequest {
  dayOfWeek: DayOfWeek | null;
  timeOfDay: string | null;
  enabled: boolean | null;
  addendum: string | null;
}

/** GET /trainer/weekly-check-ins/settings */
export async function getCheckInSettings(): Promise<WeeklyCheckInSetting[]> {
  const { data } = await api.get<WeeklyCheckInSetting[]>('/trainer/weekly-check-ins/settings');
  return data;
}

/** PUT /trainer/weekly-check-ins/settings */
export async function upsertCheckInSetting(
  request: UpsertWeeklyCheckInSettingRequest,
): Promise<WeeklyCheckInSetting> {
  const { data } = await api.put<WeeklyCheckInSetting>(
    '/trainer/weekly-check-ins/settings',
    request,
  );
  return data;
}

/** GET /trainer/weekly-check-ins/overrides */
export async function getCheckInOverrides(): Promise<WeeklyCheckInOverride[]> {
  const { data } = await api.get<WeeklyCheckInOverride[]>('/trainer/weekly-check-ins/overrides');
  return data;
}

/** PUT /trainer/weekly-check-ins/overrides/{clientUserId}/{profession} */
export async function upsertCheckInOverride(
  clientUserId: string,
  profession: Profession,
  request: UpsertWeeklyCheckInOverrideRequest,
): Promise<WeeklyCheckInOverride> {
  const { data } = await api.put<WeeklyCheckInOverride>(
    `/trainer/weekly-check-ins/overrides/${clientUserId}/${profession}`,
    request,
  );
  return data;
}

/** DELETE /trainer/weekly-check-ins/overrides/{clientUserId}/{profession} */
export async function deleteCheckInOverride(
  clientUserId: string,
  profession: Profession,
): Promise<void> {
  await api.delete(`/trainer/weekly-check-ins/overrides/${clientUserId}/${profession}`);
}
