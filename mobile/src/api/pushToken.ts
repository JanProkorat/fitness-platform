import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { api } from '@/api/client';
import { API_BASE_URL, API_TIMEOUT_MS } from '@/lib/config';

const PUSH_TOKEN_KEY = 'pushToken';

/** The Expo token this install last registered; mirrors SecureStore so logout can read it. */
let registeredToken: string | null = null;

/** Removal still in flight; a registration waits for it so a late removal cannot delete the next user's row. */
let pendingRemoval: Promise<void> | null = null;

/** Resolves when `promise` settles or after `ms`, whichever comes first. Never rejects. */
function settleWithin(promise: Promise<void>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    void promise.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Registers the device's Expo push token for the signed-in user (POST /client/push-token). */
export async function registerPushToken(token: string): Promise<void> {
  if (pendingRemoval) await settleWithin(pendingRemoval, API_TIMEOUT_MS);
  await api.registerPushTokenEndpoint({ token, platform: Platform.OS });
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

async function postRemoval(token: string): Promise<void> {
  try {
    // Anonymous on purpose: after a failed refresh there is no valid access token, and the shared
    // client would swap in the current session's token and try to refresh a session that has ended.
    await axios.post(
      `${API_BASE_URL}/client/push-token/remove`,
      { token },
      { headers: { 'Content-Type': 'application/json' }, timeout: API_TIMEOUT_MS },
    );
  } catch {
    // Best effort: logout never depends on it. No token value in the log.
    if (__DEV__) console.warn('Push token removal failed');
  }
}

/**
 * Asks the server to forget a push token, without any credentials. Never throws.
 * The call is tracked so a following registration waits for it.
 */
export function removePushToken(token: string): Promise<void> {
  const removal: Promise<void> = postRemoval(token).finally(() => {
    if (pendingRemoval === removal) pendingRemoval = null;
  });
  pendingRemoval = removal;
  return removal;
}

/** Logout clean-up: drops the stored token and asks the server to forget it. */
export async function unregisterPushToken(): Promise<void> {
  const token = await readRegisteredToken();
  registeredToken = null;
  try {
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  } catch {
    // Nothing to clean up.
  }
  if (token) await removePushToken(token);
}
