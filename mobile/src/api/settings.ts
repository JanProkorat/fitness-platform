import { api } from '@/api/client';
import { getErrorStatus, getProblemCode, isNetworkError } from '@/api/errors';
import { ApiException, NotificationEvent } from '@/api/generated';
import type { NotificationPreferenceDto } from '@/api/generated';

export const NOTIFICATION_PREFERENCES_QUERY_KEY = ['notification-preferences'] as const;

const INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD';
const PASSWORD_NOT_SET = 'PASSWORD_NOT_SET';

/** Loads the caller's preference for every notification event (GET /users/me/notification-preferences). */
export async function fetchNotificationPreferences(
  signal?: AbortSignal,
): Promise<NotificationPreferenceDto[]> {
  const response = await api.getNotificationPreferencesEndpoint(signal);
  return response.preferences ?? [];
}

/** The backend requires every event on each save, so the whole list goes back. */
export async function saveNotificationPreferences(
  preferences: NotificationPreferenceDto[],
): Promise<void> {
  await api.updateNotificationPreferencesEndpoint({ preferences });
}

/** True when email and push are both on for new chat messages. */
export function isMessagesEnabled(preferences: NotificationPreferenceDto[]): boolean {
  const entry = preferences.find((preference) => preference.event === NotificationEvent.NewMessage);
  return Boolean(entry?.email && entry.push);
}

/** The list with only the new-message entry set to `enabled` for both channels. */
export function withMessagesEnabled(
  preferences: NotificationPreferenceDto[],
  enabled: boolean,
): NotificationPreferenceDto[] {
  return preferences.map((preference) =>
    preference.event === NotificationEvent.NewMessage
      ? { ...preference, email: enabled, push: enabled }
      : preference,
  );
}

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type ChangedPassword = {
  accessToken: string;
  refreshToken: string;
};

/** Changes the password (POST /users/me/password); every older refresh token is revoked. */
export async function changePassword({
  currentPassword,
  newPassword,
}: ChangePasswordInput): Promise<ChangedPassword> {
  const response = await api.changePasswordEndpoint({
    currentPassword,
    newPassword,
    confirmPassword: newPassword,
  });
  if (!response.accessToken || !response.refreshToken) {
    throw new Error('invalid_change_password_response');
  }
  return { accessToken: response.accessToken, refreshToken: response.refreshToken };
}

/** Deletes the signed-in account (DELETE /users/me). */
export async function deleteAccount(): Promise<void> {
  await api.deleteAccountEndpoint();
}

export type ChangePasswordFailure =
  | 'invalidCurrent'
  | 'notSet'
  | 'rateLimited'
  | 'network'
  | 'generic';

/** The 400 body arrives as raw text on an ApiException. */
function readCode(error: unknown): string | undefined {
  const direct = getProblemCode(error);
  if (direct) return direct;
  if (!(error instanceof ApiException)) return undefined;
  try {
    return getProblemCode(JSON.parse(error.response) as unknown);
  } catch {
    return undefined;
  }
}

/** Maps anything `changePassword` can throw to the failure the screen shows. */
export function classifyChangePasswordError(error: unknown): ChangePasswordFailure {
  if (isNetworkError(error)) return 'network';
  if (getErrorStatus(error) === 429) return 'rateLimited';
  switch (readCode(error)) {
    case INVALID_CURRENT_PASSWORD:
      return 'invalidCurrent';
    case PASSWORD_NOT_SET:
      return 'notSet';
  }
  return 'generic';
}
