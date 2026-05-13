import { useMemo } from 'react'
import type { TodayTrainingResponse } from '@/api/training'

/**
 * Reads multi-session completion state from the server-sourced fields on
 * `TodayTrainingResponse`.
 *
 * Primary source: `completedExerciseIdsBySectionAndSession` (new per-section
 * field). Each exercise instance is keyed by (sessionId, sectionId) so the
 * same catalog exercise referenced in two different sections of one session
 * is tracked independently.
 *
 * Fallback (transitional): if the new field is absent (should not happen
 * after deploy, but guards against mid-deploy or cached API responses), the
 * old flat `completedExerciseIdsBySession` is used — every section within a
 * session sees the same flat set. This replicates the pre-fix "buggy but
 * not broken" behaviour and is clearly marked as transitional.
 *
 * Mutations write back to `completedExerciseIdsBySectionAndSession` via
 * `setQueryData`, so optimistic updates also work correctly.
 */
export function useCompletionState(trigger: TodayTrainingResponse | undefined) {
  const sessions = trigger?.sessions ?? []

  // ── Per-section completion map ─────────────────────────────────────────────
  // Shape: Map<sessionId, Map<sectionId, Set<exerciseExternalId>>>
  const completedIdsBySectionAndSession = useMemo<
    ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>
  >(() => {
    const outer = new Map<string, Map<string, Set<string>>>()

    if (trigger?.completedExerciseIdsBySectionAndSession) {
      // Primary path: use the new per-section field.
      for (const [sessionId, sectionMap] of Object.entries(
        trigger.completedExerciseIdsBySectionAndSession,
      )) {
        const inner = new Map<string, Set<string>>()
        for (const [sectionId, ids] of Object.entries(sectionMap)) {
          inner.set(sectionId, new Set(ids))
        }
        outer.set(sessionId, inner)
      }
    } else if (trigger?.completedExerciseIdsBySession) {
      // TRANSITIONAL FALLBACK: new field absent → flatten the legacy per-session
      // array across every section in that session. All sections see the same set.
      // Produces the same cross-section bleed the bug report describes, but
      // nothing crashes. Remove this branch once the new field is fully rolled out.
      for (const [sessionId, ids] of Object.entries(
        trigger.completedExerciseIdsBySession,
      )) {
        const idSet = new Set(ids)
        const session = (trigger.sessions ?? []).find((s) => s.sessionId === sessionId)
        const inner = new Map<string, Set<string>>()
        for (const section of session?.sections ?? []) {
          if (section.sectionId) {
            inner.set(section.sectionId, idSet)
          }
        }
        // Synthetic "default" section key used by the TrainingCard fallback.
        if (inner.size === 0) {
          inner.set('default', idSet)
        }
        outer.set(sessionId, inner)
      }
    }

    return outer as ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  // ── Legacy flat completedIdsBySession ─────────────────────────────────────
  // Kept for back-compat callers that need a session-level aggregate
  // (e.g. `deriveSessionCtaState`, aggregate counters). Its value is now the
  // UNION of all per-section sets within the session — derived, not consumed
  // directly from the API response. Do NOT use for per-exercise display logic;
  // use `completedIdsForSection` for that.
  const completedIdsBySession = useMemo<Record<string, ReadonlySet<string>>>(() => {
    const result: Record<string, ReadonlySet<string>> = {}
    for (const [sessionId, sectionMap] of completedIdsBySectionAndSession) {
      const union = new Set<string>()
      for (const ids of sectionMap.values()) {
        for (const id of ids) union.add(id)
      }
      result[sessionId] = union
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIdsBySectionAndSession])

  const completedSectionIdsBySession = useMemo<Record<string, ReadonlySet<string>>>(() => {
    if (!trigger?.completedSectionIdsBySession) return {}
    const result: Record<string, ReadonlySet<string>> = {}
    for (const [sessionId, ids] of Object.entries(trigger.completedSectionIdsBySession)) {
      result[sessionId] = new Set(ids)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  // A session counts as fully complete when every section in it is "done":
  //   - sections with exercises → all trackable exercises in that section are
  //     in `completedIdsForSection(sessionId, sectionId)`, OR
  //   - sections without exercises (e.g. ForTime "Running") → sectionId is in
  //     completedSectionIds.
  // Mirrors the backend ComplianceService rule.
  const sessionCompleteMap = useMemo<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {}
    for (const s of sessions) {
      if (!s.sessionId) continue
      const sectionMap = completedIdsBySectionAndSession.get(s.sessionId)
      const completedSecSet = completedSectionIdsBySession[s.sessionId] ?? new Set<string>()
      const sections = s.sections ?? []
      if (sections.length === 0) {
        result[s.sessionId] = false
        continue
      }
      result[s.sessionId] = sections.every((sec) => {
        const trackable = (sec.exercises ?? []).filter((e) => e.exerciseExternalId != null)
        if (trackable.length > 0) {
          // Use the per-section set for this section so the same catalog exercise
          // in another section doesn't satisfy this section's requirement.
          const sectionCompletedIds =
            sec.sectionId != null ? (sectionMap?.get(sec.sectionId) ?? new Set<string>()) : new Set<string>()
          return trackable.every((e) => sectionCompletedIds.has(e.exerciseExternalId!))
        }
        return sec.sectionId != null && completedSecSet.has(sec.sectionId)
      })
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIdsBySectionAndSession, completedSectionIdsBySession, sessions])

  /** Returns the completed-exercise ID set for a specific (session, section) pair. */
  function completedIdsForSection(sessionId: string, sectionId: string): ReadonlySet<string> {
    return completedIdsBySectionAndSession.get(sessionId)?.get(sectionId) ?? new Set<string>()
  }

  /** Returns the union of completed-exercise IDs across all sections in a session. */
  function completedIdsFor(sessionId: string): ReadonlySet<string> {
    return completedIdsBySession[sessionId] ?? new Set<string>()
  }

  /** Returns the completed-section ID set for a single session. */
  function completedSectionIdsFor(sessionId: string): ReadonlySet<string> {
    return completedSectionIdsBySession[sessionId] ?? new Set<string>()
  }

  /** Returns whether the whole session is marked complete. */
  function isSessionComplete(sessionId: string): boolean {
    return sessionCompleteMap[sessionId] ?? false
  }

  // Aggregate totals across all sessions (used by hero ring + StatCard chip).
  // Uses the session-union set — accurate aggregate even with per-section keying.
  const aggregateDone = useMemo<number>(() => {
    let count = 0
    for (const s of sessions) {
      if (!s.sessionId) continue
      const ids = completedIdsBySession[s.sessionId] ?? new Set<string>()
      count += ids.size
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedIdsBySession, sessions])

  const aggregateTotal = useMemo<number>(() => {
    let count = 0
    for (const s of sessions) {
      count += (s.exercises ?? []).filter((e) => e.exerciseExternalId != null).length
    }
    return count
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  return {
    completedIdsBySectionAndSession,
    completedIdsBySession,
    completedSectionIdsBySession,
    sessionCompleteMap,
    completedIdsForSection,
    completedIdsFor,
    completedSectionIdsFor,
    isSessionComplete,
    aggregateDone,
    aggregateTotal,
  }
}
