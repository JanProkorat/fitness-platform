import { useContext, useEffect, useRef } from 'react';

import { RealtimeContext } from './context';

/**
 * Runs `handler` for every `name` event the hub pushes while the caller is mounted.
 * The handler may change between renders; the latest one always runs.
 * Outside the realtime provider (signed out) this does nothing.
 */
export function useRealtimeEvent<T = unknown>(name: string, handler: (payload: T) => void): void {
  const realtime = useContext(RealtimeContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!realtime) return;
    return realtime.subscribe(name, (payload) => handlerRef.current(payload as T));
  }, [realtime, name]);
}

/** Runs `callback` after the hub connection re-establishes, when broadcasts may have been missed. */
export function useRealtimeReconnected(callback: () => void): void {
  const realtime = useContext(RealtimeContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!realtime) return;
    return realtime.subscribeReconnected(() => callbackRef.current());
  }, [realtime]);
}
