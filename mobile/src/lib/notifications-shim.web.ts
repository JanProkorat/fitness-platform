// Web shim for expo-notifications.
//
// `expo-notifications`' real module runs `ServerRegistrationModule.web.js` at
// import time, which calls `localStorage.getItem` in a way that crashes
// Expo Router's Node SSR pre-render pass. We don't ship push notifications
// on expo-web anyway — use this shim so UI smoke tests don't light the whole
// bundle on fire.
//
// All exports are no-op stubs with the right type shape. Any code that needs
// real push behavior must be behind `Platform.OS !== 'web'` guards.

type Status = 'granted' | 'denied' | 'undetermined';

export const AndroidImportance = {
  DEFAULT: 3,
  HIGH: 4,
  LOW: 2,
  MAX: 5,
  MIN: 1,
  NONE: 0,
  UNSPECIFIED: 0,
};

export function setNotificationHandler(_handler: unknown): void {
  // no-op on web
}

export async function requestPermissionsAsync(): Promise<{
  status: Status;
  granted: boolean;
  canAskAgain: boolean;
}> {
  return { status: 'denied', granted: false, canAskAgain: false };
}

export async function getPermissionsAsync(): Promise<{
  status: Status;
  granted: boolean;
  canAskAgain: boolean;
}> {
  return { status: 'undetermined', granted: false, canAskAgain: true };
}

export async function getExpoPushTokenAsync(
  _options?: unknown,
): Promise<{ data: string; type: 'expo' }> {
  return { data: '', type: 'expo' };
}

export async function setNotificationChannelAsync(
  _channelId: string,
  _channel: unknown,
): Promise<unknown> {
  return null;
}

export function addNotificationReceivedListener(_listener: unknown): {
  remove: () => void;
} {
  return { remove: () => {} };
}

export function addNotificationResponseReceivedListener(_listener: unknown): {
  remove: () => void;
} {
  return { remove: () => {} };
}

export function removeNotificationSubscription(_subscription: unknown): void {
  // no-op
}

export async function scheduleNotificationAsync(
  _content: unknown,
): Promise<string> {
  return '';
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  // no-op
}

export async function dismissAllNotificationsAsync(): Promise<void> {
  // no-op
}

export async function getBadgeCountAsync(): Promise<number> {
  return 0;
}

export async function setBadgeCountAsync(_count: number): Promise<boolean> {
  return false;
}

export type NotificationBehavior = unknown;
export type Notification = unknown;
export type NotificationResponse = unknown;

// Expo's API imports default sometimes; provide a default export too.
export default {
  AndroidImportance,
  setNotificationHandler,
  requestPermissionsAsync,
  getPermissionsAsync,
  getExpoPushTokenAsync,
  setNotificationChannelAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  removeNotificationSubscription,
  scheduleNotificationAsync,
  cancelAllScheduledNotificationsAsync,
  dismissAllNotificationsAsync,
  getBadgeCountAsync,
  setBadgeCountAsync,
};
