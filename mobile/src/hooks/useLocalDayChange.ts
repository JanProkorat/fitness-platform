import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { PLANS_QUERY_KEY } from '@/api/plans';
import { localToday } from '@/components/nutrition/plan/model';

/**
 * The device's calendar day, kept current while the app stays open (at midnight and when it returns to the
 * foreground). When the day rolls over, nutrition and plan queries are refetched so a plan that starts today
 * moves from "starts soon" to the day view without a manual refresh.
 */
export function useLocalDayChange(): string {
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => localToday());
  const previous = useRef(day);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => setDay((current) => {
      const now = localToday();
      return now === current ? current : now;
    });

    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        sync();
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };

    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      sync();
      if (timer) clearTimeout(timer);
      schedule();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (previous.current === day) return;
    previous.current = day;
    void queryClient.invalidateQueries({ queryKey: ['nutrition'] });
    void queryClient.invalidateQueries({ queryKey: PLANS_QUERY_KEY });
  }, [day, queryClient]);

  return day;
}
