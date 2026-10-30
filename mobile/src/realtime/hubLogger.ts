import { LogLevel } from '@microsoft/signalr';
import type { ILogger } from '@microsoft/signalr';

import { selectIsOffline, useConnectivityStore } from '@/stores/connectivity';

/** Transport-level failures that only mean the API cannot be reached; auth and server errors never match. */
const UNREACHABLE = /fetch failed|failed to fetch|network request failed|network error|timed out|status code: 1006/i;

/** The hub's own console logger turns every offline retry into a red Error line, so those are dropped. */
export const isUnreachableLog = (level: LogLevel, message: string, offline: boolean): boolean =>
  (level === LogLevel.Warning || level === LogLevel.Error) && (offline || UNREACHABLE.test(message));

/**
 * Console logger for the hub connection. While the app is offline, or when the line only reports an
 * unreachable server, warnings and errors are downgraded to debug output; everything else logs as usual.
 */
export const hubLogger: ILogger = {
  log(level, message) {
    const line = `[${new Date().toISOString()}] ${message}`;
    if (level < LogLevel.Warning) return;
    if (isUnreachableLog(level, message, selectIsOffline(useConnectivityStore.getState()))) {
      console.debug(line);
      return;
    }
    if (level === LogLevel.Error || level === LogLevel.Critical) console.error(line);
    else console.warn(line);
  },
};
