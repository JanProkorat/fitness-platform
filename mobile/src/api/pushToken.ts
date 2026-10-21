import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/lib/config';

const PUSH_TOKEN_KEY = 'pushToken';

/** The Expo token this install last registered; mirrors SecureStore so logout can read it. */
let registeredToken: string | null = null;

/** Registers the device's Expo push token for the signed-in user (POST /client/push-token). */
export function registerPushToken(token: string): Promise<void> {
  return api.registerPushTokenEndpoint({ token, platform: Platform.OS });
}

/** Remembers the registered token; a failed write only costs the logout clean-up after a restart. */
export async function rememberRegisteredToken(token: string): Promise<void> {
  registeredToken = token;
  try {
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  } catch {
    // Kept in memory; see above.
  }
}

async function readRegisteredToken(): Promise<string | null> {
  if (registeredToken) return registeredToken;
  try {
    return await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Removes a token from the server with an explicit bearer token.
 * Plain axios on purpose: the shared client would swap in the current session's token
 * and its 401 handler would try to refresh a session that has already ended.
 * Never throws; a rejected or expired call just leaves the server copy to age out.
 */
export async function removePushTokenAs(accessToken: string, token: string): Promise<void> {
  try {
    await axios.delete(`${API_BASE_URL}/client/push-token`, {
      params: { token },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: API_TIMEOUT_MS,
    });
  } catch {
    // Idempotent and best effort: logout never depends on it.
  }
}

/** Logout clean-up: drops the stored token and asks the server to forget it. */
export async function unregisterPushToken(accessToken: string | null): Promise<void> {
  const token = await readRegisteredToken();
  registeredToken = null;
  try {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // Nothing to clean up.
  }
  if (token && accessToken) {
    await removePushTokenAs(accessToken, token);
  }
}
