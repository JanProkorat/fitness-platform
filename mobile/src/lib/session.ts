import * as SecureStore from 'expo-secure-store';

/** Holds the signed-in user's id next to the refresh token, so a session restored offline knows its owner. */
const SESSION_USER_KEY = 'sessionUserId';
/** Name of the access-token claim that carries the user id (the backend's AppClaims.UserId). */
const USER_ID_CLAIM = 'UserId';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decodes base64url into UTF-8 text, or returns null for malformed input. */
function decodeBase64Url(input: string): string | null {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (base64.length % 4 === 1) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of base64) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  try {
    return decodeURIComponent(bytes.map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''));
  } catch {
    return null;
  }
}

/**
 * Reads the user id from an access token's payload. The signature is not checked: the id only picks which local
 * queue belongs to the session, and the server still authorizes every request by the token itself.
 */
export function userIdFromAccessToken(accessToken: string | null): string | null {
  if (!accessToken) return null;
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  const json = decodeBase64Url(payload);
  if (!json) return null;
  try {
    const claims: unknown = JSON.parse(json);
    if (typeof claims !== 'object' || claims === null) return null;
    const value = (claims as Record<string, unknown>)[USER_ID_CLAIM];
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function readStoredSessionUserId(): Promise<string | null> {
  try {
    return (await SecureStore.getItemAsync(SESSION_USER_KEY)) || null;
  } catch {
    return null;
  }
}

export function writeStoredSessionUserId(userId: string): Promise<void> {
  return SecureStore.setItemAsync(SESSION_USER_KEY, userId);
}

export async function clearStoredSessionUserId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_USER_KEY);
  } catch {
    // A stale id is replaced by the next login or refresh.
  }
}
