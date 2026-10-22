import { api } from '@/api/client';
import type { MyCheckInHistoryItem } from '@/api/generated';

export type CheckInHistoryItem = MyCheckInHistoryItem;

export type CheckInHistoryPage = {
  items: CheckInHistoryItem[];
  page: number;
  /** The endpoint reports no total, so a full page is the only hint that another one exists. */
  hasMore: boolean;
};

export const CHECK_IN_HISTORY_PAGE_SIZE = 50;

export const CHECK_IN_QUERY_KEY = ['check-ins'] as const;

export const CHECK_IN_HISTORY_QUERY_KEY = [...CHECK_IN_QUERY_KEY, 'history'] as const;

/** One page of GET /client/weekly-check-ins/history. */
export async function fetchCheckInHistoryPage(
  page: number,
  signal?: AbortSignal,
): Promise<CheckInHistoryPage> {
  const response = await api.getMyCheckInHistoryEndpoint(page, CHECK_IN_HISTORY_PAGE_SIZE, signal);
  const items = response.items ?? [];
  return { items, page, hasMore: items.length >= CHECK_IN_HISTORY_PAGE_SIZE };
}
