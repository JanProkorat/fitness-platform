import { createContext, useContext } from 'react';
import type { OfflineSyncConflictDto } from '@/api/generated';
import type { PlacedConflict } from '@/components/plan-editor/sync-conflicts/syncConflictModel';

/** What the host passes the editor: the plan's unreviewed conflicts and how to mark them reviewed. */
export interface PlanEditorSyncConflicts {
  conflicts: readonly OfflineSyncConflictDto[];
  /** First name of the client, used in the copy. */
  clientName: string;
  /** Version of the plan as loaded; the "Plan now" label falls back to the conflict's own version without it. */
  planVersion?: number;
  /** The conflict being marked reviewed right now, if any. */
  reviewingId: string | null;
  reviewingAll: boolean;
  /** Resolves true once the conflict is marked reviewed, false when the call failed. */
  onReview: (conflictId: string) => Promise<boolean>;
  onReviewAll: () => Promise<boolean>;
}

export interface SyncConflictsModel {
  clientName: string;
  planVersion: number | undefined;
  placed: readonly PlacedConflict[];
  reviewingId: string | null;
  reviewingAll: boolean;
  onReview: (conflictId: string) => Promise<boolean>;
  onReviewAll: () => Promise<boolean>;
  /** The conflict on a live meal of the week, if one is open for review. */
  forMeal: (weekIndex: number, mealId: string) => PlacedConflict | undefined;
  /** The ghosts (meals that left the plan) of a week, optionally of one weekday. */
  ghosts: (weekIndex: number, dayOfWeek?: number) => PlacedConflict[];
  /** How many conflicts show on a week / on a weekday of it. */
  countInWeek: (weekIndex: number) => number;
  countOnDay: (weekIndex: number, dayOfWeek: number) => number;
  /** The ghost whose popover is open in the week grid. */
  openGhostId: string | null;
  onOpenGhost: (conflictId: string | null) => void;
  /** Leaves the week view for the conflict's weekday. */
  onOpenDay: (placed: PlacedConflict) => void;
}

export const SyncConflictsContext = createContext<SyncConflictsModel | null>(null);

/** The editor's conflict model; null in editors without conflicts (the template editor). */
export function useSyncConflicts(): SyncConflictsModel | null {
  return useContext(SyncConflictsContext);
}

/** Builds the lookups the grid and day view read, from the placed conflicts. */
export function buildSyncConflictsModel(
  props: PlanEditorSyncConflicts,
  placed: readonly PlacedConflict[],
  openGhostId: string | null,
  onOpenGhost: (conflictId: string | null) => void,
  onOpenDay: (placed: PlacedConflict) => void,
): SyncConflictsModel {
  const located = placed.filter((item) => item.weekIndex !== null);
  return {
    clientName: props.clientName,
    planVersion: props.planVersion,
    placed,
    reviewingId: props.reviewingId,
    reviewingAll: props.reviewingAll,
    onReview: props.onReview,
    onReviewAll: props.onReviewAll,
    forMeal: (weekIndex, mealId) =>
      located.find((item) => !item.ghost && item.weekIndex === weekIndex && item.meal?.mealId === mealId),
    ghosts: (weekIndex, dayOfWeek) =>
      located.filter(
        (item) => item.ghost && item.weekIndex === weekIndex && (dayOfWeek === undefined || item.dayOfWeek === dayOfWeek),
      ),
    countInWeek: (weekIndex) => located.filter((item) => item.weekIndex === weekIndex).length,
    countOnDay: (weekIndex, dayOfWeek) =>
      located.filter((item) => item.weekIndex === weekIndex && item.dayOfWeek === dayOfWeek).length,
    openGhostId,
    onOpenGhost,
    onOpenDay,
  };
}
