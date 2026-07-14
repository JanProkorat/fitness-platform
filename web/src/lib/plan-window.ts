/**
 * Mirrors the backend's `PlanWindowResolver` (#780) on the web side. A client
 * may now hold several sequential, non-overlapping nutrition/training plans
 * of the same type at once, so screens that used to grab "the" Active plan
 * via `plans[0]` (implicitly relying on the old single-active-plan invariant)
 * must instead pick the plan whose date window contains a given day, or fall
 * back to a stable newest-first ordering for list views.
 *
 * A plan's window is `[startDate, startDate + weekCount * 7)` — half-open, so
 * a plan's last day is `startDate + weekCount * 7 - 1`. Plans without a
 * `startDate` (legacy data, or an unscheduled Draft) are "unranged": they
 * never match `resolveCurrentPlan` except via the single-candidate legacy
 * fallback described below.
 */

export interface PlanWindowLike {
  startDate?: string | null;
  weekCount: number;
  dateCreated: string;
}

function isWithinWindow(startDate: string, weekCount: number, today: Date): boolean {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(start.getDate() + weekCount * 7);
  return today >= start && today < end;
}

/**
 * Selects the plan out of `plans` whose window contains `now`. `plans`
 * should already be pre-filtered to the client + status the caller cares
 * about (e.g. `status === 'Active'`) — this only applies the date-window
 * selection on top, mirroring `PlanWindowResolver.ResolveCurrentPlan`.
 *
 * Returns `null` when no candidate's window contains `now` — callers must
 * surface that as an empty/placeholder state, never fall back to an
 * arbitrary candidate.
 *
 * Legacy single-plan fallback: when there is exactly one candidate and it
 * has no `startDate`, it is returned as-is — before #780 a client could only
 * ever have one Active same-type plan, so an unranged legacy plan was
 * unambiguously "the" current plan.
 */
export function resolveCurrentPlan<T extends PlanWindowLike>(
  plans: readonly T[],
  now: Date = new Date(),
): T | null {
  const inWindow = plans
    .filter((p): p is T & { startDate: string } => p.startDate != null && isWithinWindow(p.startDate, p.weekCount, now))
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  if (inWindow.length > 0) return inWindow[0];

  if (plans.length === 1 && plans[0].startDate == null) {
    return plans[0];
  }

  return null;
}

/**
 * Sorts plans newest-first: primary key `startDate` desc (unranged/Draft
 * plans sort as oldest), tiebreak `dateCreated` desc. Mirrors the ordering
 * used by `GET /trainer/clients/{clientId}/plans` (`ListClientPlansEndpoint`)
 * so every plan-list surface in the web app agrees on ordering.
 */
export function sortPlansNewestFirst<T extends PlanWindowLike>(plans: readonly T[]): T[] {
  return [...plans].sort((a, b) => {
    const aStart = a.startDate ? new Date(a.startDate).getTime() : -Infinity;
    const bStart = b.startDate ? new Date(b.startDate).getTime() : -Infinity;
    if (aStart !== bStart) return bStart - aStart;
    return new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime();
  });
}
