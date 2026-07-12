import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTrainerCheckIns,
  getClientCurrentCheckIn,
  markCheckInReviewed,
  type Profession,
  type TrainerCheckInDto,
  type ClientCheckInDto,
  type MarkCheckInReviewedResponse,
} from '@/api/weekly-checkins';

// ── Query key factories ──────────────────────────────────────────────────────

export const weeklyCheckInKeys = {
  /** All trainer weekly-check-in queries */
  all: ['weekly-check-ins'] as const,
  /**
   * List for the dashboard "Weekly check-ins" card.
   * Omit `weekStartDate` for the active (week-agnostic) set — pending,
   * responded, and expired check-ins that aren't dismissed/reviewed yet.
   * Pass an ISO Monday date to keep the exact-week filter (history view).
   */
  trainerList: (weekStartDate?: string) =>
    ['weekly-check-ins', 'trainer-list', weekStartDate ?? 'active'] as const,
  /** Current check-in for a specific client (+ optional profession filter) */
  clientCurrent: (clientUserId: string, profession?: Profession) =>
    ['weekly-check-ins', 'client-current', clientUserId, profession ?? 'all'] as const,
} as const;

// ── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Returns the trainer's clients' weekly check-ins for the dashboard card.
 *
 * @param weekStartDate - Optional. Omit to get the active set (pending,
 *   responded, and expired check-ins that aren't dismissed by the client or
 *   already reviewed by the trainer), regardless of calendar week. Pass an
 *   ISO Monday date (YYYY-MM-DD) to preserve the exact-week filter (kept for
 *   a future history view).
 */
export function useTrainerWeeklyCheckIns(weekStartDate?: string): {
  data: TrainerCheckInDto[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: weeklyCheckInKeys.trainerList(weekStartDate),
    queryFn: () => getTrainerCheckIns(weekStartDate),
    staleTime: 60_000,
  });

  return {
    data: data?.checkIns ?? [],
    isLoading,
  };
}

/**
 * Returns the current week's check-in for a specific client, optionally
 * filtered to one profession. Used by plan-editor banners and client detail.
 *
 * @param clientUserId - Client's ApplicationUser Id (Guid string).
 * @param profession   - Optional profession filter ("Training" | "Nutrition").
 */
export function useClientCurrentCheckIn(
  clientUserId: string,
  profession?: Profession,
): {
  data: ClientCheckInDto[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: weeklyCheckInKeys.clientCurrent(clientUserId, profession),
    queryFn: () => getClientCurrentCheckIn(clientUserId, profession),
    staleTime: 60_000,
    enabled: Boolean(clientUserId),
  });

  return {
    data: data?.checkIns ?? [],
    isLoading,
  };
}

/**
 * Mutation for POST /trainer/weekly-check-ins/{id}/mark-reviewed.
 * On success, invalidates both the trainer list and client-current queries
 * so banners update without a page reload.
 */
export function useMarkCheckInReviewed(): {
  mutate: (id: string) => void;
  isPending: boolean;
  data: MarkCheckInReviewedResponse | undefined;
} {
  const queryClient = useQueryClient();

  const { mutate, isPending, data } = useMutation({
    mutationFn: (id: string) => markCheckInReviewed(id),
    onSuccess: () => {
      // Invalidate all weekly check-in queries (trainer list + all client-currents)
      void queryClient.invalidateQueries({ queryKey: weeklyCheckInKeys.all });
    },
  });

  return { mutate, isPending, data };
}
