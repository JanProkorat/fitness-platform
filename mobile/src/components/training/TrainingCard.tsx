import React, { useMemo, useState, useCallback } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { AnimatedCollapse } from './AnimatedCollapse'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { GoldButton } from '@/components/ui/GoldButton'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { ExpandableSessionCard } from '@/components/training/ExpandableSessionCard'
import { ExpandableExerciseCard } from '@/components/training/ExpandableExerciseCard'
import {
  estimatedSectionDurationSeconds,
  formatDurationCompact,
  formatExerciseSummary,
} from '@/lib/training-plan-format'
import { SectionHeader } from '@/components/training/SectionHeader'
import { SetGrid } from '@/components/training/SetGrid'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import type { TrainingSession, TrainingSection, MuscleGroup, SessionPhotoDto } from '@/api/training'
import type { SessionCtaState } from './trainingCardHelpers'
import { SessionEditingBanner } from '@/components/today/SessionEditingBanner'

// ─── Section fallback ──────────────────────────────────────────────────────────

/**
 * If a session has no sections (legacy flat plan not yet backfilled),
 * synthesize a single default section wrapping all flat exercises.
 * This matches the schema-on-read semantics of WithBackfilledSections on the backend.
 */
function getEffectiveSections(
  session: TrainingSession,
  t: (key: string) => string,
): TrainingSection[] {
  if (session.sections && session.sections.length > 0) {
    return session.sections
  }
  // Fallback: wrap flat exercises in a single default section
  const exercises = session.exercises ?? []
  if (exercises.length === 0) return []
  return [
    {
      sectionId: 'default',
      order: 0,
      name: t('training.section.defaultName'),
      format: undefined,
      formatConfig: undefined,
      exercises,
    },
  ]
}

interface TrainingCardProps {
  /** Eyebrow text shown above the aggregate headline (e.g. "Plan name · Week 3"). */
  planName: string
  /** All sessions scheduled for today, ordered by `order`. */
  sessions: TrainingSession[]
  /**
   * Per-session, per-section completed-exercise IDs.
   * Outer key = sessionId, inner key = sectionId, value = set of exerciseExternalIds.
   * Derived from `completedExerciseIdsBySectionAndSession` in the optimistic cache.
   * Each section's set is independent so the same catalog exercise in two sections
   * of one session is tracked separately (fixes cross-section bleed).
   */
  completedIdsBySectionAndSession: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>>
  /**
   * Session-level union of all section completion sets, keyed by sessionId.
   * Used only for aggregate counters and CTA-state derivation where a
   * section-scoped set is not needed.
   */
  completedIdsBySession: Record<string, ReadonlySet<string>>
  /**
   * Per-session completed-section IDs, keyed by sessionId. Sections live here
   * when they don't track at the exercise level (e.g. ForTime "Running"
   * workouts that have no exercises).
   */
  completedSectionIdsBySession?: Record<string, ReadonlySet<string>>
  /**
   * Per-session "is the whole session complete" flags, keyed by sessionId.
   */
  sessionCompleteMap: Record<string, boolean>
  /** Called when the user taps a per-exercise checkbox. */
  onToggleExercise?: (sessionId: string, sectionId: string, exerciseExternalId: string) => void
  /**
   * Called when the section-complete checkbox is tapped on a section that
   * has trackable exercises. Receives the sectionId, the full array of exercise
   * IDs that need to flip, and the target completion state.
   * Using this instead of firing N separate `onToggleExercise` calls avoids a
   * race where parallel mutations all read the same stale version token from cache.
   */
  onToggleExercises?: (sessionId: string, sectionId: string, exerciseIds: string[], complete: boolean) => void
  /**
   * Called when the user taps the section-complete checkbox on a section
   * that has no trackable exercises (typically ForTime).
   */
  onToggleSection?: (sessionId: string, sectionId: string) => void
  /** Called when the user taps a session-level checkbox. */
  onToggleSession?: (sessionId: string) => void
  /**
   * CTA state per session, keyed by sessionId.
   * When absent for a session, the per-session CTA footer is not rendered.
   */
  sessionCtaStateBySession?: Record<string, SessionCtaState>
  /**
   * Called when the user taps the per-session CTA button (start / continue).
   * Not invoked for the `finished` state — that renders a non-interactive chip.
   */
  onSessionCta?: (session: TrainingSession, state: SessionCtaState) => void
  /** Returns true when the startWorkout mutation for the given sessionId is pending. */
  isSessionCtaPending?: (sessionId: string) => boolean
  /**
   * Set of sessionIds whose Start CTA should be locked because another session
   * is currently live. Computed by `computeLockedSessionIds` in HasTrainerState.
   * Defaults to an empty set when omitted — no sessions are locked.
   */
  lockedSessionIds?: ReadonlySet<string>
  /**
   * Map from exerciseExternalId to its muscle groups, sourced from the backend's
   * `GetTodaySessionResponse.exerciseMuscleGroups` field. Used to render colored
   * muscle-group chips in the hero and a per-exercise dot in each exercise row.
   * Defaults to `{}` when omitted so the card stays presentational.
   */
  exerciseMuscleGroups?: Record<string, MuscleGroup[]>
  /**
   * Per-session, per-exercise completed set numbers from
   * `GetTodaySessionResponse.completedSetsBySessionExercise`.
   * Keyed by sessionId → exerciseExternalId → 1-based set numbers.
   * Defaults to `{}` when omitted.
   */
  completedSetsBySessionExercise?: Record<string, Record<string, number[]>>
  /**
   * Called when the user taps "Mark whole day done". Hidden when every session
   * is already marked complete or there are no sessions.
   */
  onMarkAllTrainingDone?: () => void
  /** True while the markWholeDayComplete mutation is in flight. */
  isMarkAllTrainingLoading?: boolean
  /**
   * Per-session edit-lock state map, keyed by sessionId.
   * Value is "Stable" | "Editing" | "Live".
   * Missing key → treat as "Stable" (no banner).
   * Sourced from GetTodaySessionResponse.lockStateBySession (#382).
   */
  lockStateBySession?: Record<string, string>
  /**
   * Called when the user taps the camera icon on a session card header.
   * Receives the sessionId so HasTrainerState can navigate to the
   * session-scoped session-log-photo screen with the correct context.
   * When absent, no camera button is rendered on the session card.
   */
  onSessionPhotoPress?: (sessionId: string) => void
  /**
   * Per-session diary photos from today's session logs, keyed by sessionId.
   * Used to render the "Fotky dne" horizontal strip beneath the training card
   * and per-session photo indicators/lightbox inside each ExpandableSessionCard.
   * Mirrors `mealPhotosByMealId` in NutritionCard.
   * Sourced from `photosBySession` in TodayTrainingResponse (#405).
   */
  photosBySession?: Record<string, SessionPhotoDto[]>
}

// ─── formatSets ───────────────────────────────────────────────────────────────

function formatSets(exercise: NonNullable<TrainingSession['exercises']>[number]): string {
  const sets = exercise.sets ?? []
  const setCount = sets.length
  const firstReps = sets[0]?.reps
  const firstWeight = sets[0]?.weightKg
  const parts: string[] = []
  parts.push(`${setCount}`)
  if (firstReps != null) parts.push(String(firstReps))
  if (firstWeight != null) parts.push(`${firstWeight} kg`)
  if (parts.length === 1) return `${setCount} sets`
  return `${setCount} × ${firstReps != null ? firstReps : '—'}${firstWeight != null ? ` · ${firstWeight} kg` : ''}`
}

// ─── SessionCtaFooter ─────────────────────────────────────────────────────────

interface SessionCtaFooterProps {
  session: TrainingSession
  state: SessionCtaState
  isPending: boolean
  onPress: (session: TrainingSession, state: SessionCtaState) => void
  /**
   * When true, another session is currently live. The CTA is rendered
   * disabled with a "Session already in progress" label. The not-locked
   * code path is not affected.
   */
  locked?: boolean
}

function SessionCtaFooter({ session, state, isPending, onPress, locked = false }: SessionCtaFooterProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const isDisabled = isPending || locked

  return (
    <View style={[ctaStyles.footerButton, { borderTopColor: colors.sep2 }]}>
      <Pressable
        onPress={() => {
          if (!isDisabled) onPress(session, state)
        }}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={locked ? t('today.trainingCta.sessionInProgress') : undefined}
        style={({ pressed }) => [
          ctaStyles.primaryButton,
          locked
            ? { backgroundColor: colors.bg3, opacity: 0.7 }
            : { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {isPending && !locked ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Text
            style={[
              ctaStyles.primaryLabel,
              locked ? { color: colors.label3 } : { color: colors.onAccent },
            ]}
          >
            {locked
              ? t('today.trainingCta.sessionInProgress')
              : state === 'in-progress'
                ? t('today.trainingCta.continue')
                : t('today.trainingCta.start')}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

const ctaStyles = StyleSheet.create({
  footerButton: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    // Hairline above the CTA so the boundary between the last exercise row
    // and the action zone is unambiguous.
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryLabel: {
    ...Type.callout,
    fontFamily: interFamily('700'),
    fontWeight: '700',
  },
})

// ─── TrainingCard ─────────────────────────────────────────────────────────────

export function TrainingCard({
  planName,
  sessions,
  completedIdsBySectionAndSession,
  completedIdsBySession,
  completedSectionIdsBySession = {},
  sessionCompleteMap,
  onToggleExercise,
  onToggleExercises,
  onToggleSection,
  onToggleSession,
  sessionCtaStateBySession,
  onSessionCta,
  isSessionCtaPending,
  lockedSessionIds = new Set<string>(),
  exerciseMuscleGroups = {},
  completedSetsBySessionExercise = {},
  onMarkAllTrainingDone,
  isMarkAllTrainingLoading,
  lockStateBySession = {},
  onSessionPhotoPress,
  photosBySession = {},
}: TrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // Flatten all photos from all sessions for the "Fotky dne" strip.
  // Mirrors NutritionCard's allPhotos derivation from mealPhotosByMealId.
  const allPhotos = useMemo<{ blobUrl: string; sessionId: string; note?: string | null }[]>(() => {
    return Object.entries(photosBySession).flatMap(([sessionId, photos]) =>
      photos.map((p) => ({ blobUrl: p.blobUrl, sessionId, note: p.note })),
    )
  }, [photosBySession])

  const allPhotoUrls = useMemo(() => allPhotos.map((p) => p.blobUrl), [allPhotos])
  const allPhotoNotes = useMemo(() => allPhotos.map((p) => p.note ?? null), [allPhotos])

  const [lightbox, setLightbox] = useState<{ visible: boolean; startIndex: number }>(
    { visible: false, startIndex: 0 },
  )

  // Aggregate training-session counts for the hero ring. The ring tracks how
  // many of today's training sessions the client has fully completed (via
  // the per-session checkbox / live runner finish flow).
  const totalSessions = sessions.length
  const completedSessions = sessions.reduce((sum, s) => {
    if (!s.sessionId) return sum
    return sum + (sessionCompleteMap[s.sessionId] ? 1 : 0)
  }, 0)

  // True iff at least one session is not yet marked complete — controls CTA visibility.
  const hasIncompleteSessions = sessions.some(
    (s) => s.sessionId != null && !sessionCompleteMap[s.sessionId],
  )

  // Deduplicated muscle groups across all exercises (first-seen order).
  const aggregatedMuscleGroups = useMemo<MuscleGroup[]>(() => {
    const seen = new Set<MuscleGroup>()
    const result: MuscleGroup[] = []
    for (const session of sessions) {
      for (const ex of session.exercises ?? []) {
        const id = ex.exerciseExternalId
        if (!id) continue
        const mgs = exerciseMuscleGroups[id] ?? []
        for (const mg of mgs) {
          if (!seen.has(mg)) {
            seen.add(mg)
            result.push(mg)
          }
        }
      }
    }
    return result
  }, [sessions, exerciseMuscleGroups])

  // Hero headline: "N tréninkových jednotek"
  const heroHeadline = t('today.sessionsCount', { count: totalSessions })

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* ── Hero section ── */}
      <View style={[styles.hero, { backgroundColor: colors.heroBg }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroContent}>
            {/* Eyebrow: plan name · week number */}
            <Text
              style={[styles.planName, { color: colors.onAccent }]}
              numberOfLines={1}
            >
              {planName}
            </Text>

            {/* Aggregate session count headline */}
            <Text style={[styles.sessionName, { color: colors.onAccent }]}>
              {heroHeadline}
            </Text>

            {/* Muscle-group chips — deduplicated across all sessions */}
            {aggregatedMuscleGroups.length > 0 && (
              <View style={styles.chipRow}>
                {aggregatedMuscleGroups.map((mg) => {
                  const chipColor = getMuscleGroupColor(mg, colors)
                  return (
                    <View
                      key={mg}
                      style={[styles.chip, { backgroundColor: chipColor + '33' }]}
                    >
                      <Text style={[styles.chipLabel, { color: chipColor }]}>
                        {t(`muscleGroup.${mg}`)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>

          {/* Progress ring: completed / total training sessions */}
          <View style={styles.ringContainer}>
            <ProgressRing
              current={completedSessions}
              total={totalSessions}
              size={56}
              strokeWidth={5}
              color={colors.gold}
              trackColor={colors.onAccent + '26'}
              labelColor={colors.onAccent}
            />
          </View>
        </View>
      </View>

      {/* ── Session list ── */}
      <View style={[styles.body, { backgroundColor: colors.bg2 }]}>
        {sessions.map((session, idx) => {
          const sessionId = session.sessionId ?? `session-${idx}`
          // Session-union set used only for CTA state and aggregate counts.
          const completedIds = completedIdsBySession[sessionId] ?? new Set<string>()
          // Per-section map for this session — passed to SessionSectionList for
          // per-exercise display so cross-section bleed is impossible.
          const sessionSectionCompletionMap =
            completedIdsBySectionAndSession.get(sessionId) ?? new Map<string, ReadonlySet<string>>()
          const isComplete = sessionCompleteMap[sessionId] ?? false

          // Session summary mirrors the trainer-portal logic: workouts (= sections)
          // count, total timed duration, and untimed count when there's a mix.
          // See `web/src/pages/TrainingPlanPage.tsx` for the source of this formula.
          const sectionsForSummary = getEffectiveSections(session, t)
          const sectionDurations = sectionsForSummary.map((sec) =>
            estimatedSectionDurationSeconds(sec.format, sec.formatConfig),
          )
          const timedSeconds = sectionDurations.reduce<number>(
            (sum, d) => sum + (d ?? 0),
            0,
          )
          const untimedCount = sectionDurations.filter(
            (d) => d == null || d === 0,
          ).length
          const summaryParts: string[] = [
            t('training.workoutCount', { count: sectionsForSummary.length }),
          ]
          if (timedSeconds > 0) summaryParts.push(formatDurationCompact(timedSeconds))
          if (timedSeconds > 0 && untimedCount > 0) {
            summaryParts.push(t('training.workoutUntimedCount', { count: untimedCount }))
          }
          const sessionSummary = summaryParts.join(' · ')

          // Per-session CTA — hide entirely when the session is finished;
          // completion is already surfaced by the session-level checkbox.
          const ctaState = sessionCtaStateBySession?.[sessionId]
          const showCta =
            ctaState != null && ctaState !== 'finished' && onSessionCta != null
          const ctaPending = isSessionCtaPending?.(sessionId) ?? false
          // When another session is live, lock this session's CTA.
          const ctaLocked = session.sessionId != null && lockedSessionIds.has(session.sessionId)

          // Session-level checkbox injected into the session card header.
          // Uses the View+inner-icon pattern from MealRow's CheckButton so the
          // styling lines up with the section- and exercise-level checkboxes.
          const sessionCheckbox = onToggleSession ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation()
                onToggleSession(sessionId)
              }}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isComplete }}
              accessibilityLabel={t('today.sessionCheckboxA11y')}
              style={[
                styles.sessionCheck,
                isComplete
                  ? { backgroundColor: colors.green, borderColor: colors.green }
                  : { backgroundColor: 'transparent', borderColor: colors.sep },
              ]}
            >
              {isComplete && (
                <Ionicons name="checkmark" size={14} color={colors.onAccent} />
              )}
            </Pressable>
          ) : undefined

          // Derive sections (falls back to single default section for legacy flat plans)
          const sections = getEffectiveSections(session, t)

          return (
            <SessionSectionList
              key={sessionId}
              sessionId={sessionId}
              index={idx}
              isFirst={idx === 0}
              isSessionComplete={isComplete}
              name={session.name ?? ''}
              summaryText={sessionSummary}
              completedIds={completedIds}
              sectionCompletionMap={sessionSectionCompletionMap}
              completedSectionIds={completedSectionIdsBySession[sessionId] ?? new Set<string>()}
              sections={sections}
              sessionCheckbox={sessionCheckbox}
              showCta={showCta}
              ctaState={ctaState}
              ctaPending={ctaPending}
              ctaLocked={ctaLocked}
              session={session}
              exerciseMuscleGroups={exerciseMuscleGroups}
              completedSetsBySessionExercise={completedSetsBySessionExercise[sessionId] ?? {}}
              sessionLockState={lockStateBySession[session.sessionId ?? ''] ?? 'Stable'}
              onToggleExercise={onToggleExercise}
              onToggleExercises={onToggleExercises}
              onToggleSection={onToggleSection}
              onSessionCta={onSessionCta}
              onSessionPhotoPress={
                onSessionPhotoPress && session.sessionId
                  ? () => onSessionPhotoPress(session.sessionId!)
                  : undefined
              }
              sessionPhotos={
                session.sessionId != null
                  ? (photosBySession[session.sessionId] ?? [])
                  : []
              }
              t={t}
            />
          )
        })}
      </View>

      {/* Photo strip — "Fotky dne" — visible only when at least one session has diary photos.
          Mirrors NutritionCard's photoStrip section exactly. */}
      {allPhotos.length > 0 ? (
        <View style={styles.photoStrip}>
          <Text style={[styles.photoStripLabel, { color: colors.label3 }]}>
            {t('training.todayPhotos')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoStripContent}
          >
            {allPhotos.map((photo, index) => (
              <Pressable
                key={`${photo.sessionId}-${index}`}
                style={styles.photoStripTile}
                onPress={() => setLightbox({ visible: true, startIndex: index })}
              >
                <Image
                  source={{ uri: photo.blobUrl }}
                  style={styles.photoStripImage}
                  resizeMode="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Card-level lightbox for the photo strip */}
      <ImageLightbox
        visible={lightbox.visible}
        images={allPhotoUrls}
        startIndex={lightbox.startIndex}
        onClose={() => setLightbox({ visible: false, startIndex: 0 })}
        imageNotes={allPhotoNotes}
      />

      {/* Mark whole day done — hidden when every session is already complete or no sessions */}
      {onMarkAllTrainingDone && hasIncompleteSessions && sessions.length > 0 && (
        <View style={styles.markAllWrap}>
          <GoldButton
            title={t('today.markAllTrainingDone')}
            onPress={onMarkAllTrainingDone}
            loading={isMarkAllTrainingLoading}
            icon="checkmark"
          />
        </View>
      )}
    </View>
  )
}

// ─── SessionSectionList ───────────────────────────────────────────────────────
// Extracted so section-collapse state lives per session, not globally.

interface SessionSectionListProps {
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
  sections: ReturnType<typeof getEffectiveSections>
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
  t: (key: string, opts?: Record<string, unknown>) => string
}

function SessionSectionList({
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
                            >
                              <SetGrid sets={sets} completedSetNumbers={completedSetNumbers} />
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
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  hero: {
    padding: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroContent: {
    flex: 1,
    minWidth: 0,
  },
  planName: {
    ...Type.caption1,
    fontFamily: interFamily('600'),
    fontWeight: '600',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sessionName: {
    ...Type.title2,
    letterSpacing: -0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
  },
  chipLabel: {
    ...Type.caption2,
    fontFamily: interFamily('600'),
    fontWeight: '600',
  },
  ringContainer: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  body: {
    // No padding — session strips run edge-to-edge inside the card body,
    // matching the MealRow strips inside NutritionCard.
    gap: 0,
  },
  sectionEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Hairline below every section — matches the divider style used between
  // food/recipe rows and between meal cards in NutritionCard. Color supplied
  // inline from the theme (sep2 — the lighter of the two separator tokens).
  sectionWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Session-level checkbox — MealRow CheckButton pattern: 24×24, radius 12,
  // borderWidth 2. marginLeft 10 matches MealRow's `styles.check.marginLeft`.
  sessionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  // Mirrors NutritionCard's ctaWrap — same padding values for visual parity.
  markAllWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  // Photo strip — mirrors NutritionCard's photoStrip styles exactly.
  photoStrip: {
    marginTop: 12,
    marginBottom: 4,
  },
  photoStripLabel: {
    ...Type.caption2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  photoStripContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  photoStripTile: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  photoStripImage: {
    width: '100%',
    height: '100%',
  },
})

export default TrainingCard
