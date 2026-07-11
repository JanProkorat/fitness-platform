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
import type { TrainingSession, TrainingSection, MuscleGroup, SessionPhotoDto } from '@/api/training'
import type { LoggedSetDto } from '@/api/wod-types'
import type { SessionCtaState } from './trainingCardHelpers'
import { deriveExerciseHasModifications } from './trainingCardHelpers'
import { SessionEditingBanner } from '@/components/today/SessionEditingBanner'
import { SessionReminderRow } from '@/components/training/SessionReminderRow'
import { SessionCtaFooter } from './SessionCtaFooter'

// ─── SessionSectionList ───────────────────────────────────────────────────────
// Extracted so section-collapse state lives per session, not globally.

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
   * for empty sections that don't have an explicit `completedSectionIds`
   * entry yet (e.g. immediately after `markSessionComplete`).
   */
  isSessionComplete: boolean
  name: string
  summaryText: string
  /**
   * Session-union of all section completion sets. Used for aggregate counts
   * (completedWorkouts tally) where section-scoped precision is not needed.
   */
  completedIds: ReadonlySet<string>
  /**
   * Per-section completion map for this session (inner key = sectionId).
   * Used for per-exercise `isDone` computation so the same catalog exercise
   * in two sections of one session is tracked independently.
   */
  sectionCompletionMap: ReadonlyMap<string, ReadonlySet<string>>
  /** Section IDs that have been section-completed for this session. */
  completedSectionIds: ReadonlySet<string>
  sections: TrainingSection[]
  sessionCheckbox: React.ReactNode
  showCta: boolean
  ctaState: SessionCtaState | undefined
  ctaPending: boolean
  /** When true, another session is live — this session's CTA is locked. */
  ctaLocked: boolean
  session: TrainingSession
  exerciseMuscleGroups: Record<string, MuscleGroup[]>
  completedSetsBySessionExercise: Record<string, number[]>
  /**
   * Edit-lock state for this specific session.
   * "Editing" → show the gold warning banner above the CTA.
   * "Stable" / "Live" / anything else → no banner.
   */
  sessionLockState?: string
  onToggleExercise?: (sessionId: string, sectionId: string, exerciseExternalId: string) => void
  /** Batch variant — dispatches N exercise toggles sequentially to avoid version-token races. */
  onToggleExercises?: (sessionId: string, sectionId: string, exerciseIds: string[], complete: boolean) => void
  onToggleSection?: (sessionId: string, sectionId: string) => void
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
  completedIds,
  sectionCompletionMap,
  completedSectionIds,
  sections,
  sessionCheckbox,
  showCta,
  ctaState,
  ctaPending,
  ctaLocked,
  session,
  exerciseMuscleGroups,
  completedSetsBySessionExercise,
  sessionLockState,
  onToggleExercise,
  onToggleExercises,
  onToggleSection,
  onSessionCta,
  onSessionPhotoPress,
  sessionPhotos,
  loggedSetsForSession,
  sessionHasModifications,
  planId,
  t,
}: SessionSectionListProps) {
  const colors = useTheme()

  // Per-section expand/collapse state. Defaults all to false — sessions
  // collapse by default (ExpandableSessionCard.defaultExpanded = false), and
  // their workouts/exercises mirror that so the card opens flat.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((s, i) => [s.sectionId ?? `section-${i}`, false])
    )
  )

  const handleToggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
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
              {/* Section-grouped exercise cards */}
              {sections.map((section, sectionIdx) => {
                const sectionKey = section.sectionId ?? `section-${sectionIdx}`
                const sectionExercises = section.exercises ?? []
                // Always render the section header — the user needs the
                // "mark whole section finished" checkbox even on single-section
                // sessions, and the visual fidelity to the prototype requires
                // a band per section regardless of count.
                const showSectionHeader = true
                // WOD-format sections store a single round-prescription "set"
                // per exercise. The "set" concept doesn't apply, so the row's
                // summary skips the count prefix and the row is non-expandable.
                const isWodFormat =
                  section.format != null && section.format !== 'Standard'

                // Empty section edge case — show band with empty-state row
                const hasExercises = sectionExercises.length > 0
                // Empty sections (e.g. ForTime "Running") have no body to show,
                // so they always render collapsed — keeps the card to a single
                // header row matching the missing chevron.
                const isExpanded = hasExercises && (expandedSections[sectionKey] ?? false)

                // Per-section completed-exercise set — the source of truth for
                // per-exercise isDone and isSectionComplete. Using this instead
                // of the session-union `completedIds` prevents a catalog exercise
                // referenced in two sections from having both instances flip when
                // only one is tapped.
                const sectionCompletedIds: ReadonlySet<string> =
                  section.sectionId != null
                    ? (sectionCompletionMap.get(section.sectionId) ?? new Set<string>())
                    : new Set<string>()

                // Section-complete state:
                //   - sections with trackable exercises → all of them must be done
                //     in THIS section's set (not the session union).
                //   - sections with zero trackable exercises (e.g. ForTime
                //     "Running") → look up their sectionId in
                //     `completedSectionIds`, falling back to the session-level
                //     flag while the optimistic cache catches up.
                const trackableExercises = sectionExercises.filter(
                  (e) => e.exerciseExternalId != null,
                )
                const sectionInCompletedSet =
                  section.sectionId != null && completedSectionIds.has(section.sectionId)
                const isSectionComplete = trackableExercises.length > 0
                  ? trackableExercises.every((e) => sectionCompletedIds.has(e.exerciseExternalId!))
                  : (sectionInCompletedSet || isSessionComplete)

                // onToggleSectionComplete:
                //   - For sections WITH trackable exercises, fan out to the
                //     existing per-exercise toggle so the section becomes
                //     complete iff every exercise in it is complete.
                //   - For sections with no trackable exercises (ForTime "Running"),
                //     call the section-level endpoint directly so the section
                //     can be marked done without exercises to attach to.
                let handleToggleSectionComplete: (() => void) | undefined
                if (trackableExercises.length > 0) {
                  // Prefer the batch variant (onToggleExercises) so all N mutations
                  // are dispatched sequentially via mutateAsync — each one reads the
                  // version updated by the previous response rather than racing on
                  // the same stale token. Fall back to firing individual onToggleExercise
                  // calls only when the batch handler is not provided.
                  if (onToggleExercises && section.sectionId != null) {
                    const secId = section.sectionId
                    handleToggleSectionComplete = () => {
                      const idsToFlip: string[] = []
                      for (const ex of trackableExercises) {
                        const exId = ex.exerciseExternalId!
                        const isDone = sectionCompletedIds.has(exId)
                        if (isSectionComplete ? isDone : !isDone) {
                          idsToFlip.push(exId)
                        }
                      }
                      if (idsToFlip.length > 0) {
                        // `complete` flips to the OPPOSITE of the current section state.
                        const targetComplete = !isSectionComplete
                        onToggleExercises(sessionId, secId, idsToFlip, targetComplete)
                      }
                    }
                  } else if (onToggleExercise && section.sectionId != null) {
                    const secId = section.sectionId
                    handleToggleSectionComplete = () => {
                      for (const ex of trackableExercises) {
                        const exId = ex.exerciseExternalId!
                        const isDone = sectionCompletedIds.has(exId)
                        if (isSectionComplete ? isDone : !isDone) {
                          onToggleExercise(sessionId, secId, exId)
                        }
                      }
                    }
                  }
                } else if (onToggleSection && section.sectionId != null) {
                  const secId = section.sectionId
                  handleToggleSectionComplete = () => onToggleSection(sessionId, secId)
                }

                const sectionDuration = estimatedSectionDurationSeconds(
                  section.format,
                  section.formatConfig,
                )

                const isLastSection = sectionIdx === sections.length - 1
                return (
                  <View
                    key={sectionKey}
                    style={[
                      styles.sectionWrap,
                      isLastSection
                        ? { borderBottomWidth: 0 }
                        : { borderBottomColor: colors.sep2 },
                    ]}
                  >
                    {showSectionHeader && (
                      <SectionHeader
                        name={section.name ?? t('training.section.defaultName')}
                        format={section.format}
                        formatConfig={section.formatConfig}
                        durationSeconds={sectionDuration}
                        exerciseCount={sectionExercises.length}
                        notes={section.notes}
                        isExpanded={isExpanded}
                        onToggleExpanded={() => handleToggleSection(sectionKey)}
                        isSectionComplete={isSectionComplete}
                        onToggleSectionComplete={handleToggleSectionComplete}
                        // No exercises → no detail to expand into. ForTime
                        // workouts can legitimately be just a name + time cap
                        // (e.g. "Running"); other empty sections share the same
                        // UX — drop the chevron and disable the row toggle.
                        nonExpandable={!hasExercises}
                        // Case A — section collapsed: the parent sectionWrap's
                        // borderBottomWidth already provides the row-level
                        // divider; the header's own bottom border would stack
                        // on top of it producing a double-hairline.
                        //
                        // Case B — section expanded: the note now renders inside
                        // the header's labelCol; no standalone note banner below.
                        // Suppress the bottom border only when collapsed (case A).
                        suppressBottomDivider={!isExpanded}
                      />
                    )}

                    {/* Exercise rows — AnimatedCollapse renders content always
                        (for measurement) and animates height. Empty sections
                        (no exercises) are forced collapsed via `isExpanded`
                        above, so no body renders for them. */}
                    <AnimatedCollapse expanded={isExpanded}>
                        {sectionExercises.map((exercise, exIdx) => {
                          const exId = exercise.exerciseExternalId ?? null
                          // Use the per-section set so the same catalog exercise in
                          // another section of this session is unaffected.
                          const isDone = exId != null && sectionCompletedIds.has(exId)
                          const sets = exercise.sets ?? []
                          const completedSetNumbers =
                            exId != null
                              ? (completedSetsBySessionExercise[exId] ?? [])
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
                          const exMuscleGroups = exId != null ? (exerciseMuscleGroups[exId] ?? []) : []
                          const primaryMg = exMuscleGroups[0]
                          // Fallback to brand gold (not label3 grey) so the dot
                          // stays visible even on the format-tinted section bands
                          // when muscle-group data hasn't loaded yet.
                          const dotColor = primaryMg != null
                            ? getMuscleGroupColor(primaryMg, colors)
                            : colors.gold

                          // Derive per-exercise modification flag from per-set
                          // isModified flags (#441 — plan endpoint has no per-exercise
                          // field; GetTodaySession has loggedSetsBySessionExercise).
                          const exHasModifications =
                            exId != null
                              ? deriveExerciseHasModifications(exId, loggedSetsForSession)
                              : false

                          return (
                            <ExpandableExerciseCard
                              key={exId ?? exIdx}
                              name={exercise.exerciseName ?? ''}
                              summaryText={exSummary}
                              dotColor={dotColor}
                              isCompleted={isDone}
                              defaultExpanded={false}
                              nested
                              nestedFirst={exIdx === 0 && !showSectionHeader}
                              nonExpandable={isWodFormat}
                              // WOD exercises don't track per-exercise completion —
                              // the whole section is marked done via the section
                              // header's checkbox instead.
                              hideCompletionIndicator={isWodFormat}
                              onToggle={
                                onToggleExercise && exId != null && section.sectionId != null
                                  ? () => onToggleExercise(sessionId, section.sectionId!, exId)
                                  : undefined
                              }
                              notes={exercise.notes}
                              hasModifications={exHasModifications}
                            >
                              <SetGrid
                                sets={sets}
                                completedSetNumbers={completedSetNumbers}
                                loggedSets={
                                  exId != null
                                    ? (loggedSetsForSession?.[exId] ?? undefined)
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
  // Hairline below every section — matches the divider style used between
  // food/recipe rows and between meal cards in NutritionCard. Color supplied
  // inline from the theme (sep2 — the lighter of the two separator tokens).
  sectionWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})

export default SessionSectionList
