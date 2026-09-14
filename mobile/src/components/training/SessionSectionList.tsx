import React, { useState, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { AnimatedCollapse } from './AnimatedCollapse'
import { ExpandableSessionCard } from '@/components/training/ExpandableSessionCard'
import { ExpandableExerciseCard } from '@/components/training/ExpandableExerciseCard'
import {
  estimatedSectionDurationSeconds,
  formatExerciseSummary,
} from '@/lib/training-plan-format'
import { SectionHeader } from '@/components/training/SectionHeader'
import { SetGrid } from '@/components/training/SetGrid'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import type { TrainingSession, MuscleGroup, SessionPhotoDto } from '@/api/training'
import type { SessionListItem } from './trainingCardFormat'
import { getOrderedSessionItems } from './trainingCardFormat'
import type { LoggedSetDto } from '@/api/wod-types'
import type { SessionCtaState } from './trainingCardHelpers'
import { deriveExerciseHasModifications } from './trainingCardHelpers'
import { SessionEditingBanner } from '@/components/today/SessionEditingBanner'
import { SessionReminderRow } from '@/components/training/SessionReminderRow'
import { SessionCtaFooter } from './SessionCtaFooter'

// ─── SessionSectionList ───────────────────────────────────────────────────────
// Extracted so item-collapse state lives per session, not globally.
// Renders one ordered list of session items — real TrainingWorkout blocks
// interleaved with standalone-exercise wrappers, see trainingCardFormat's
// getOrderedSessionItems for the merge/order rules.

export interface SessionSectionListProps {
  sessionId: string
  index: number
  /**
   * When true, suppresses the top hairline divider on the session strip —
   * the first session needs no separator between itself and the hero above.
   * Passed through to `ExpandableSessionCard`.
   */
  isFirst: boolean
  /**
   * Whether the parent session has been marked complete. Used as a fallback
   * for empty workouts that don't have an explicit `completedWorkoutIds`
   * entry yet (e.g. immediately after `markSessionComplete`).
   */
  isSessionComplete: boolean
  name: string
  summaryText: string
  /**
   * Flat set of completed exercise INSTANCE ids (`SessionExercise.exerciseId`)
   * for this session. Because every placement of an exercise — nested in a
   * workout, or standalone — has its own distinct instance id, this single
   * flat set is sufficient to track completion without per-workout
   * indirection: two placements of the same catalog exercise in one session
   * can never cross-satisfy each other's completion check.
   */
  completedExerciseInstanceIds: ReadonlySet<string>
  /** Workout IDs that have been workout-completed for this session (used for
   * workouts with no trackable exercises, e.g. a ForTime "Running" workout). */
  completedWorkoutIds: ReadonlySet<string>
  session: TrainingSession
  sessionCheckbox: React.ReactNode
  showCta: boolean
  ctaState: SessionCtaState | undefined
  ctaPending: boolean
  /** When true, another session is live — this session's CTA is locked. */
  ctaLocked: boolean
  exerciseMuscleGroups: Record<string, MuscleGroup[]>
  completedSetsBySessionExercise: Record<string, number[]>
  /**
   * Edit-lock state for this specific session.
   * "Editing" → show the gold warning banner above the CTA.
   * "Stable" / "Live" / anything else → no banner.
   */
  sessionLockState?: string
  /** Called when the user taps a per-exercise checkbox. `exerciseId` is the
   * per-instance id (NOT the catalog exerciseExternalId) — the mark-complete
   * route resolves against the session's instance ids directly. */
  onToggleExercise?: (sessionId: string, exerciseId: string) => void
  /** Batch variant — dispatches N exercise toggles sequentially to avoid version-token races. */
  onToggleExercises?: (sessionId: string, exerciseIds: string[], complete: boolean) => void
  /** Called when the whole-workout checkbox is tapped on a workout with no
   * trackable exercises (typically ForTime). */
  onToggleWorkout?: (sessionId: string, workoutId: string) => void
  onSessionCta?: (session: TrainingSession, state: SessionCtaState) => void
  /**
   * When provided, a camera button is rendered in the session card header.
   * Passed through to ExpandableSessionCard's `onPhotoPress` prop.
   * Already pre-bound to the specific sessionId by the parent TrainingCard.
   */
  onSessionPhotoPress?: () => void
  /**
   * Diary photos for this specific session, already sliced from `photosBySession`.
   * Passed to ExpandableSessionCard so the per-session badge + lightbox work.
   */
  sessionPhotos?: SessionPhotoDto[]
  /**
   * Per-exercise logged sets for this specific session (inner key = exerciseExternalId).
   * Already sliced from `loggedSetsBySessionExercise[sessionId]` by the parent.
   * Passed down to SetGrid for treatment B rendering (#440).
   */
  loggedSetsForSession?: Record<string, LoggedSetDto[]>
  /**
   * Whether this session has any modifications overall.
   * Sourced from `hasModificationsBySession[sessionId]`.
   * Passed to ExpandableSessionCard to render the session-level "upraveno" badge.
   */
  sessionHasModifications?: boolean
  /**
   * Training plan id forwarded to ExpandableSessionCard's `bodyFooter` so the
   * SessionReminderRow can namespace its MMKV key correctly. When omitted, no
   * reminder toggle is rendered in the expanded session body.
   */
  planId?: string
  t: (key: string, opts?: Record<string, unknown>) => string
}

export function SessionSectionList({
  sessionId,
  index,
  isFirst,
  isSessionComplete,
  name,
  summaryText,
  completedExerciseInstanceIds,
  completedWorkoutIds,
  session,
  sessionCheckbox,
  showCta,
  ctaState,
  ctaPending,
  ctaLocked,
  exerciseMuscleGroups,
  completedSetsBySessionExercise,
  sessionLockState,
  onToggleExercise,
  onToggleExercises,
  onToggleWorkout,
  onSessionCta,
  onSessionPhotoPress,
  sessionPhotos,
  loggedSetsForSession,
  sessionHasModifications,
  planId,
  t,
}: SessionSectionListProps) {
  const colors = useTheme()

  const items: SessionListItem[] = getOrderedSessionItems(session)

  // Per-item expand/collapse state. Defaults all to false — sessions
  // collapse by default (ExpandableSessionCard.defaultExpanded = false), and
  // their workouts/exercises mirror that so the card opens flat.
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      items.map((item, i) => [item.itemId ?? `item-${i}`, false])
    )
  )

  const handleToggleItem = useCallback((itemKey: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }))
  }, [])

  return (
            <ExpandableSessionCard
              key={sessionId}
              index={index}
              isFirst={isFirst}
              name={name}
              summaryText={summaryText}
              headerRight={sessionCheckbox}
              onPhotoPress={onSessionPhotoPress}
              photos={sessionPhotos}
              hasModifications={sessionHasModifications ?? false}
              bodyFooter={
                planId != null
                  ? <SessionReminderRow session={session} planId={planId} />
                  : undefined
              }
            >
              {/* Item-grouped exercise cards — real workouts and standalone
                  exercises rendered through the same band-per-item path. */}
              {items.map((item, itemIdx) => {
                const itemKey = item.itemId ?? `item-${itemIdx}`
                const itemExercises = item.exercises ?? []
                // Always render the item header — the user needs the
                // "mark whole workout finished" checkbox even on single-item
                // sessions, and the visual fidelity to the prototype requires
                // a band per item regardless of count.
                const showItemHeader = true
                // WOD-format items store a single round-prescription "set"
                // per exercise. The "set" concept doesn't apply, so the row's
                // summary skips the count prefix and the row is non-expandable.
                const isWodFormat =
                  item.format != null && item.format !== 'Standard'

                // Empty workout edge case — show band with empty-state row
                const hasExercises = itemExercises.length > 0
                // Empty workouts (e.g. ForTime "Running") have no body to show,
                // so they always render collapsed — keeps the card to a single
                // header row matching the missing chevron.
                const isExpanded = hasExercises && (expandedItems[itemKey] ?? false)

                // Trackable exercises are identified by their per-instance
                // exerciseId — the same id `completedExerciseInstanceIds`
                // is keyed on. Because instance ids are unique per placement,
                // no per-workout indirection is needed to keep two placements
                // of the same catalog exercise independent.
                const trackableExercises = itemExercises.filter(
                  (e) => e.exerciseId != null,
                )

                // Item-complete state:
                //   - items with trackable exercises → all of them must be
                //     done per the flat instance-id set.
                //   - items with zero trackable exercises (e.g. ForTime
                //     "Running") → look up the workoutId in
                //     `completedWorkoutIds`, falling back to the session-level
                //     flag while the optimistic cache catches up. Standalone
                //     items are never in this branch — a standalone exercise
                //     with no exerciseId simply has nothing to toggle.
                const workoutInCompletedSet =
                  !item.isStandalone && item.itemId != null && completedWorkoutIds.has(item.itemId)
                const isItemComplete = trackableExercises.length > 0
                  ? trackableExercises.every((e) => completedExerciseInstanceIds.has(e.exerciseId!))
                  : (workoutInCompletedSet || isSessionComplete)

                // handleToggleItemComplete:
                //   - For items WITH trackable exercises, fan out to the
                //     existing per-exercise toggle so the item becomes
                //     complete iff every exercise instance in it is complete.
                //   - For real workouts with no trackable exercises (ForTime
                //     "Running"), call the workout-level endpoint directly so
                //     the workout can be marked done without exercises to
                //     attach to. Standalone items never take this branch —
                //     they always resolve through the per-exercise path above,
                //     or (if untrackable) have nothing to toggle.
                let handleToggleItemComplete: (() => void) | undefined
                if (trackableExercises.length > 0) {
                  // Prefer the batch variant (onToggleExercises) so all N mutations
                  // are dispatched sequentially via mutateAsync — each one reads the
                  // version updated by the previous response rather than racing on
                  // the same stale token. Fall back to firing individual onToggleExercise
                  // calls only when the batch handler is not provided.
                  if (onToggleExercises) {
                    handleToggleItemComplete = () => {
                      const idsToFlip: string[] = []
                      for (const ex of trackableExercises) {
                        const exId = ex.exerciseId!
                        const isDone = completedExerciseInstanceIds.has(exId)
                        if (isItemComplete ? isDone : !isDone) {
                          idsToFlip.push(exId)
                        }
                      }
                      if (idsToFlip.length > 0) {
                        // `complete` flips to the OPPOSITE of the current item state.
                        const targetComplete = !isItemComplete
                        onToggleExercises(sessionId, idsToFlip, targetComplete)
                      }
                    }
                  } else if (onToggleExercise) {
                    handleToggleItemComplete = () => {
                      for (const ex of trackableExercises) {
                        const exId = ex.exerciseId!
                        const isDone = completedExerciseInstanceIds.has(exId)
                        if (isItemComplete ? isDone : !isDone) {
                          onToggleExercise(sessionId, exId)
                        }
                      }
                    }
                  }
                } else if (!item.isStandalone && onToggleWorkout && item.itemId != null) {
                  const workoutId = item.itemId
                  handleToggleItemComplete = () => onToggleWorkout(sessionId, workoutId)
                }

                const itemDuration = estimatedSectionDurationSeconds(
                  item.format,
                  item.formatConfig,
                )

                const isLastItem = itemIdx === items.length - 1
                return (
                  <View
                    key={itemKey}
                    style={[
                      styles.sectionWrap,
                      isLastItem
                        ? { borderBottomWidth: 0 }
                        : { borderBottomColor: colors.sep2 },
                    ]}
                  >
                    {showItemHeader && (
                      <SectionHeader
                        name={item.name ?? t('training.section.defaultName')}
                        format={item.format}
                        formatConfig={item.formatConfig}
                        durationSeconds={itemDuration}
                        exerciseCount={itemExercises.length}
                        notes={item.notes}
                        isExpanded={isExpanded}
                        onToggleExpanded={() => handleToggleItem(itemKey)}
                        isSectionComplete={isItemComplete}
                        onToggleSectionComplete={handleToggleItemComplete}
                        // No exercises → no detail to expand into. ForTime
                        // workouts can legitimately be just a name + time cap
                        // (e.g. "Running"); other empty workouts share the same
                        // UX — drop the chevron and disable the row toggle.
                        nonExpandable={!hasExercises}
                        // Case A — item collapsed: the parent sectionWrap's
                        // borderBottomWidth already provides the row-level
                        // divider; the header's own bottom border would stack
                        // on top of it producing a double-hairline.
                        //
                        // Case B — item expanded: the note now renders inside
                        // the header's labelCol; no standalone note banner below.
                        // Suppress the bottom border only when collapsed (case A).
                        suppressBottomDivider={!isExpanded}
                      />
                    )}

                    {/* Exercise rows — AnimatedCollapse renders content always
                        (for measurement) and animates height. Empty workouts
                        (no exercises) are forced collapsed via `isExpanded`
                        above, so no body renders for them. */}
                    <AnimatedCollapse expanded={isExpanded}>
                        {itemExercises.map((exercise, exIdx) => {
                          const instanceId = exercise.exerciseId ?? null
                          const catalogId = exercise.exerciseExternalId ?? null
                          const isDone = instanceId != null && completedExerciseInstanceIds.has(instanceId)
                          const sets = exercise.sets ?? []
                          // Planned-set backfill is still keyed by the catalog
                          // id — metadata (name/muscle groups/planned sets)
                          // stays catalog-keyed by design; only completion is
                          // instance-keyed.
                          const completedSetNumbers =
                            catalogId != null
                              ? (completedSetsBySessionExercise[catalogId] ?? [])
                              : []

                          // Exercise summary — single source of truth via
                          // `formatExerciseSummary`. Handles every movement
                          // type (Reps / Time / Distance / RepsForTime)
                          // with min–max ranges across sets, identical to
                          // the web `SectionCard` header.
                          const exSummary = formatExerciseSummary(
                            sets,
                            // SessionExercise carries `movementType` only on
                            // newer plans; older payloads default to Reps.
                            exercise.movementType,
                            isWodFormat,
                          )

                          // Dot color: first muscle group for this exercise, or neutral grey fallback.
                          const exMuscleGroups = catalogId != null ? (exerciseMuscleGroups[catalogId] ?? []) : []
                          const primaryMg = exMuscleGroups[0]
                          // Fallback to brand gold (not label3 grey) so the dot
                          // stays visible even on the format-tinted item bands
                          // when muscle-group data hasn't loaded yet.
                          const dotColor = primaryMg != null
                            ? getMuscleGroupColor(primaryMg, colors)
                            : colors.gold

                          // Derive per-exercise modification flag from per-set
                          // isModified flags (#441 — plan endpoint has no per-exercise
                          // field; GetTodaySession has loggedSetsBySessionExercise).
                          const exHasModifications =
                            catalogId != null
                              ? deriveExerciseHasModifications(catalogId, loggedSetsForSession)
                              : false

                          return (
                            <ExpandableExerciseCard
                              key={instanceId ?? exIdx}
                              name={exercise.exerciseName ?? ''}
                              summaryText={exSummary}
                              dotColor={dotColor}
                              isCompleted={isDone}
                              defaultExpanded={false}
                              nested
                              nestedFirst={exIdx === 0 && !showItemHeader}
                              nonExpandable={isWodFormat}
                              // WOD exercises don't track per-exercise completion —
                              // the whole workout is marked done via the item
                              // header's checkbox instead.
                              hideCompletionIndicator={isWodFormat}
                              onToggle={
                                onToggleExercise && instanceId != null
                                  ? () => onToggleExercise(sessionId, instanceId)
                                  : undefined
                              }
                              notes={exercise.notes}
                              hasModifications={exHasModifications}
                            >
                              <SetGrid
                                sets={sets}
                                completedSetNumbers={completedSetNumbers}
                                loggedSets={
                                  catalogId != null
                                    ? (loggedSetsForSession?.[catalogId] ?? undefined)
                                    : undefined
                                }
                              />
                            </ExpandableExerciseCard>
                          )
                        })}
                    </AnimatedCollapse>
                  </View>
                )
              })}

              {/* Session editing banner — shown when a trainer holds the edit lock.
                  AC (a): cosmetic warning only; Start button remains tappable. */}
              <SessionEditingBanner lockState={sessionLockState} />

              {/* Per-session CTA footer — ctaState and onSessionCta are non-null when showCta is true */}
              {showCta && ctaState != null && onSessionCta != null && (
                <SessionCtaFooter
                  session={session}
                  state={ctaState}
                  isPending={ctaPending}
                  locked={ctaLocked}
                  onPress={onSessionCta}
                />
              )}
            </ExpandableSessionCard>
  )
}

const styles = StyleSheet.create({
  // Hairline below every item — matches the divider style used between
  // food/recipe rows and between meal cards in NutritionCard. Color supplied
  // inline from the theme (sep2 — the lighter of the two separator tokens).
  sectionWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})

export default SessionSectionList
