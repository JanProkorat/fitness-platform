import { View, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { GoldButton } from '@/components/ui/GoldButton'
import {
  estimatedSectionDurationSeconds,
  formatDurationCompact,
} from '@/lib/training-plan-format'
import type { TrainingSession, MuscleGroup, SessionPhotoDto } from '@/api/training'
import type { LoggedSetDto } from '@/api/wod-types'
import type { SessionCtaState } from './trainingCardHelpers'
import { getEffectiveSections } from './trainingCardFormat'
import { TrainingCardHero } from './TrainingCardHero'
import { SessionSectionList } from './SessionSectionList'

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
   * Called when the section-complete checkbox is tapped on a section
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
  /**
   * Per-session, per-exercise logged sets with actual values, snapshot-planned
   * values, and isModified flag. Outer key = sessionId, inner key = exerciseExternalId.
   * Sourced from `loggedSetsBySessionExercise` in TodayTrainingResponse (#440).
   * When present, SetGrid renders treatment B (actual headline + planned caption + dot).
   */
  loggedSetsBySessionExercise?: Record<string, Record<string, LoggedSetDto[]>>
  /**
   * Per-session roll-up modification flag, keyed by sessionId.
   * Sourced from `hasModificationsBySession` in TodayTrainingResponse (#440).
   * When true for a session, the session-level "upraveno" badge is shown in the
   * ExpandableSessionCard header for that session.
   */
  hasModificationsBySession?: Record<string, boolean>
  /**
   * Training plan id passed through to each session card's `bodyFooter` slot
   * so the `SessionReminderRow` uses the correct MMKV namespace
   * (`session-<planId>-<sessionId>`). When omitted, the reminder toggle is not
   * rendered in the expanded session body.
   */
  planId?: string
}

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
  loggedSetsBySessionExercise,
  hasModificationsBySession,
  planId,
}: TrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // True iff at least one session is not yet marked complete — controls CTA visibility.
  const hasIncompleteSessions = sessions.some(
    (s) => s.sessionId != null && !sessionCompleteMap[s.sessionId],
  )

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* ── Hero section ── */}
      <TrainingCardHero
        planName={planName}
        sessions={sessions}
        exerciseMuscleGroups={exerciseMuscleGroups}
        sessionCompleteMap={sessionCompleteMap}
      />

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
              loggedSetsForSession={
                session.sessionId != null
                  ? loggedSetsBySessionExercise?.[session.sessionId]
                  : undefined
              }
              sessionHasModifications={
                session.sessionId != null
                  ? (hasModificationsBySession?.[session.sessionId] ?? false)
                  : false
              }
              planId={planId}
              t={t}
            />
          )
        })}
      </View>

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

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  body: {
    // No padding — session strips run edge-to-edge inside the card body,
    // matching the MealRow strips inside NutritionCard.
    gap: 0,
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
})

export default TrainingCard
