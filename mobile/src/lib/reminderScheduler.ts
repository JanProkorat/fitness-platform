/**
 * reminderScheduler — domain-agnostic daily push-notification scheduler.
 *
 * Key namespace:  reminders:v1:<domain>-<entityExternalId>[-<variant>]
 * Examples:
 *   supplement-<externalId>        (issue #332)
 *   meal-<externalId>              (issue #333)
 *   session-<externalId>           (issue #333)
 *   water-default                  (issue #334)
 *
 * MMKV storage instance:  'mmkv.reminders'
 *
 * Web-platform guard:  scheduling/cancellation returns early with a
 * structured { scheduled: false, reason: 'web-unsupported' } value before any
 * expo-notifications call. Metro resolves expo-notifications to the
 * notifications-shim.web.ts no-op bundle at build time, but the Platform.OS
 * guard ensures consumers receive a clean result even if the shim is called.
 *
 * Permission flow: calls getPermissionsAsync() first, then
 * requestPermissionsAsync() if not yet granted (idempotent — the OS returns
 * its cached decision on repeat calls). Reuses the existing notification
 * infrastructure from (client)/(tabs)/_layout.tsx — no new setNotificationHandler.
 */

import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import * as Notifications from 'expo-notifications';

// ─── MMKV instance ───────────────────────────────────────────────────────────

// Guard: MMKV throws on Node SSR (expo-web pre-render pass).
let _mmkv: ReturnType<typeof createMMKV> | null = null;
function getMMKV(): ReturnType<typeof createMMKV> | null {
  if (Platform.OS === 'web') return null;
  if (!_mmkv) {
    _mmkv = createMMKV({ id: 'mmkv.reminders' });
  }
  return _mmkv;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReminderTime {
  /** Hour in 24h format (0–23). */
  hour: number;
  /** Minute (0–59). */
  minute: number;
}

export interface ScheduleDailyReminderOptions {
  /**
   * Stable key for this reminder.
   * Format: <domain>-<entityExternalId>[-<variant>]
   * Examples: "supplement-abc123", "meal-xyz456", "water-default"
   */
  key: string;
  time: ReminderTime;
  /** Push notification title. */
  title: string;
  /** Push notification body. */
  body: string;
  /** Optional data payload attached to the notification. */
  data?: Record<string, unknown>;
}

export interface ScheduleResult {
  scheduled: boolean;
  reason?: 'permission-denied' | 'web-unsupported';
}

interface StoredReminder {
  /** expo-notifications identifier of the scheduled notification. */
  notificationId: string;
  time: ReminderTime;
  enabled: boolean;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────

/** Full MMKV key: reminders:v1:<key> */
function storageKey(key: string): string {
  return `reminders:v1:${key}`;
}

function readStored(key: string): StoredReminder | null {
  const store = getMMKV();
  if (!store) return null;
  const raw = store.getString(storageKey(key));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredReminder;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: StoredReminder): void {
  const store = getMMKV();
  if (!store) return;
  store.set(storageKey(key), JSON.stringify(value));
}

function deleteStored(key: string): void {
  const store = getMMKV();
  if (!store) return;
  store.remove(storageKey(key));
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Schedules (or reschedules) a daily push notification at the given time.
 * Idempotent: cancels any existing scheduled notification for `key` first.
 *
 * Returns { scheduled: true } on success.
 * Returns { scheduled: false, reason } when the platform is web or
 * the user denied notification permissions.
 */
export async function scheduleDailyReminder(
  opts: ScheduleDailyReminderOptions,
): Promise<ScheduleResult> {
  if (Platform.OS === 'web') {
    return { scheduled: false, reason: 'web-unsupported' };
  }

  // Cancel any previously scheduled notification for this key (idempotent).
  await cancelReminder(opts.key);

  // Permission check — reuses the OS-cached grant from the tab-layout flow.
  let perms = await Notifications.getPermissionsAsync();
  if (!perms.granted) {
    perms = await Notifications.requestPermissionsAsync();
  }
  if (!perms.granted) {
    return { scheduled: false, reason: 'permission-denied' };
  }

  const trigger: Notifications.DailyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: opts.time.hour,
    minute: opts.time.minute,
  };

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: true,
    },
    trigger,
  });

  writeStored(opts.key, {
    notificationId,
    time: opts.time,
    enabled: true,
  });

  return { scheduled: true };
}

/**
 * Cancels the scheduled notification for `key` and removes MMKV state.
 * No-op if no reminder is stored for the key.
 */
export async function cancelReminder(key: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const stored = readStored(key);
  if (!stored) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(stored.notificationId);
  } catch {
    // The notification may have already fired or been purged — ignore.
  }

  deleteStored(key);
}

/**
 * Returns the stored reminder state for `key`, or null if none is stored.
 */
export function getReminder(key: string): { time: ReminderTime; enabled: boolean } | null {
  const stored = readStored(key);
  if (!stored) return null;
  return { time: stored.time, enabled: stored.enabled };
}

/**
 * Returns all reminder keys stored in MMKV, optionally filtered by prefix.
 *
 * The returned strings are the domain key portion (everything after
 * "reminders:v1:"). Prefix filtering is a plain `startsWith` match.
 *
 * Used for orphan-cleanup (AC #10): after a plan fetch returns, diff the
 * returned externalIds against listReminderKeys('supplement-') and call
 * cancelReminder() on any orphans.
 *
 * @example
 *   const keys = listReminderKeys('supplement-');
 *   // Returns ["supplement-abc123", "supplement-def456"]
 */
export function listReminderKeys(prefix?: string): string[] {
  const store = getMMKV();
  if (!store) return [];

  const allKeys = store.getAllKeys();
  const ns = 'reminders:v1:';

  return allKeys
    .filter((k) => k.startsWith(ns))
    .map((k) => k.slice(ns.length))
    .filter((k) => (prefix ? k.startsWith(prefix) : true));
}
