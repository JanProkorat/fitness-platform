import React from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ExerciseRow } from '@/components/training/ExerciseRow'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import type { TrainingSession, MuscleGroup } from '@/api/training'
import type { SessionCtaState } from './trainingCardHelpers'

interface TrainingCardProps {
  /** Eyebrow text shown above the session name (e.g. "Plan name · Week 3"). */
  planName: string
  session: TrainingSession
  /**
   * Set of exercise external IDs that are currently marked complete.
   * Derived from optimistic mutation cache in HasTrainerState.
   */
  completedExerciseIds?: ReadonlySet<string>
  /**
   * Whether the entire session has been marked complete.
   * Controls the session-level checkbox state and the bulk CTA label.
   */
  sessionComplete?: boolean
  /**
   * Estimated session duration in minutes.
   * Currently not returned by GetTodaySessionResponse — will be populated when
   * the backend adds it. Omitted from the subtitle line when null/undefined.
   */
  estimatedDurationMinutes?: number | null
  /**
   * Muscle groups to display as coloured chips below the subtitle.
   *
   * GetTodaySessionResponse returns a TrainingSession whose SessionExercise
   * entries do NOT carry muscleGroups (that field lives on ExerciseDto in the
   * full-plan response). Pass them here when available; defaults to [] so the
   * hero renders correctly even without the enriched data.
   */
  muscleGroups?: MuscleGroup[]
  /**
   * Called when the user taps the exercise-level checkbox.
   * When undefined the checkbox is not rendered.
   */
  onToggleExercise?: (exerciseExternalId: string) => void
  /**
   * Called when the user taps the session-level checkbox or the session header
   * toggle area.
   * When undefined the session-level toggle is not rendered.
   */
  onToggleSession?: () => void
  /**
   * Called when the user taps "Mark the whole training as done".
   * When undefined the bulk CTA is not rendered.
   */
  onMarkWholeDayComplete?: () => void
  /**
   * Whether the bulk "mark whole day" mutation is pending.
   * Disables the button while true.
   */
  isWholeDayPending?: boolean
  /**
   * When provided, the whole card becomes tappable and navigates to the live
   * session screen for set-logging.
   *
   * Omit (or pass undefined) to render the card as a non-interactive view.
   *
   * NOTE: the card-level tap gesture and the inner checkboxes are separate
   * hit targets; the checkboxes call stopPropagation-equivalent via their own
   * onPress handlers, so tapping a checkbox does NOT trigger onPress.
   */
  onPress?: () => void
  /**
   * CTA state for this session — controls label and interaction of the per-session
   * footer button. When undefined, the per-session CTA footer is not rendered.
   *
   * Replaces the former `onContinue()` prop. All navigation / mutation logic
   * lives in the parent (HasTrainerState); the card remains presentational.
   */
  sessionCtaState?: SessionCtaState
  /**
   * Called when the user taps the per-session CTA button or viewSummary link.
   * Receives the session and its current state so the parent can route correctly.
   *
   * When undefined, the per-session CTA footer is not rendered.
   */
  onSessionCta?: (session: TrainingSession, state: SessionCtaState) => void
  /**
   * Whether the startWorkout mutation is currently pending.
   * Shows an activity indicator in the CTA button while true.
   */
  isSessionCtaPending?: boolean
}

function formatSets(exercise: NonNullable<TrainingSession['exercises']>[number]): string {
  // Generated types make sets optional; guard with ?? [].
  const sets = exercise.sets ?? []
  const setCount = sets.length
  const reps = sets[0]?.reps
  if (reps) return `${setCount} x ${reps}`
  return `${setCount} sets`
}

export function TrainingCard({
  planName,
  session,
  completedExerciseIds,
  sessionComplete = false,
  estimatedDurationMinutes,
  muscleGroups = [],
  onToggleExercise,
  onToggleSession,
  onMarkWholeDayComplete,
  isWholeDayPending = false,
  onPress,
  sessionCtaState,
  onSessionCta,
  isSessionCtaPending = false,
}: TrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const exercises = session.exercises ?? []
  const totalExercises = exercises.length
  const completedExercises = completedExerciseIds
    ? exercises.filter((ex) => ex.exerciseExternalId != null && completedExerciseIds.has(ex.exerciseExternalId)).length
    : 0

  // Subtitle: "<N> cviků · <M> min" — minute part omitted when duration is unknown.
  const subtitleParts: string[] = [
    t('today.exercisesCount', { count: totalExercises }),
  ]
  if (estimatedDurationMinutes != null) {
    subtitleParts.push(t('today.minuteCount', { minutes: estimatedDurationMinutes }))
  }
  const subtitle = subtitleParts.join(' \u00b7 ')

  // Deduplicate muscle group chips while preserving insertion order.
  const uniqueMuscleGroups = muscleGroups.filter(
    (mg, idx, arr) => arr.indexOf(mg) === idx,
  )

  const showBulkCta = onMarkWholeDayComplete != null

  // Per-session CTA footer: only rendered when both props are provided.
  const showSessionCta = sessionCtaState != null && onSessionCta != null

  const sessionCtaFooter = showSessionCta ? (
    sessionCtaState === 'finished' ? (
      // Finished state: ✓ Dokončeno chip + optional viewSummary link
      <View style={[styles.ctaFooter, { borderTopColor: colors.sep2 }]}>
        <View style={[styles.finishedChip, { backgroundColor: colors.green + '1f' }]}>
          <View style={[styles.finishedCheck, { backgroundColor: colors.green }]}>
            <Ionicons name="checkmark" size={11} color={colors.onAccent} />
          </View>
          <Text style={[styles.finishedLabel, { color: colors.green }]}>
            {t('today.trainingCta.finished')}
          </Text>
        </View>
        {/* Secondary link: viewSummary — tapping navigates to the summary.
            The chip itself is non-interactive; summary navigation is opt-in
            via this link so the chip doesn't accidentally trigger navigation. */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation()
            onSessionCta(session, sessionCtaState)
          }}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[styles.viewSummaryLink, { color: colors.gold }]}>
            {t('today.trainingCta.viewSummary')} ›
          </Text>
        </Pressable>
      </View>
    ) : (
      // not-started or in-progress: gold primary button
      <View style={styles.ctaFooterButton}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation()
            if (!isSessionCtaPending) {
              onSessionCta(session, sessionCtaState)
            }
          }}
          disabled={isSessionCtaPending}
          accessibilityRole="button"
          accessibilityState={{ disabled: isSessionCtaPending }}
          style={({ pressed }) => [
            styles.primaryCtaButton,
            { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {isSessionCtaPending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={[styles.primaryCtaLabel, { color: colors.onAccent }]}>
              {sessionCtaState === 'in-progress'
                ? t('today.trainingCta.continue')
                : t('today.trainingCta.start')}
            </Text>
          )}
        </Pressable>
      </View>
    )
  ) : null

  const cardContent = (
    <>
      {/* Hero section */}
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

            {/* Headline: session name + session-level checkbox */}
            <View style={styles.sessionHeader}>
              <Text style={[styles.sessionName, { color: colors.onAccent, flex: 1 }]} numberOfLines={2}>
                {session.name}
              </Text>
              {onToggleSession && (
                <Pressable
                  onPress={(e) => {
                    // Prevent the outer card Pressable from firing too.
                    e.stopPropagation()
                    onToggleSession()
                  }}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sessionComplete }}
                  accessibilityLabel={t('today.sessionCheckboxA11y')}
                  style={styles.sessionCheckbox}
                >
                  <Ionicons
                    name={sessionComplete ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={sessionComplete ? colors.green : colors.onAccent}
                  />
                </Pressable>
              )}
            </View>

            {/* Subtitle: exercises · minutes */}
            <Text style={[styles.subtitle, { color: colors.onAccent }]}>
              {subtitle}
            </Text>

            {/* Muscle group chips */}
            {uniqueMuscleGroups.length > 0 && (
              <View style={styles.muscleGroups}>
                {uniqueMuscleGroups.map((mg) => {
                  const chipColor = getMuscleGroupColor(mg, colors)
                  return (
                    <View
                      key={mg}
                      style={[styles.muscleChip, { backgroundColor: chipColor + '33' }]}
                    >
                      <Text style={[styles.muscleChipLabel, { color: chipColor }]}>
                        {t(`muscleGroup.${mg}`)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>

          {/* Progress ring: completed / total exercises */}
          <View style={styles.ringContainer}>
            <ProgressRing
              current={completedExercises}
              total={totalExercises}
              size={56}
              strokeWidth={5}
              color={colors.gold}
            />
          </View>
        </View>
      </View>

      {/* Exercise list */}
      <View style={styles.body}>
        {exercises.map((exercise, idx) => {
          const exId = exercise.exerciseExternalId ?? null
          const isDone = exId != null && (completedExerciseIds?.has(exId) ?? false)
          return (
            <ExerciseRow
              key={exId ?? idx}
              name={exercise.exerciseName ?? ''}
              setsDescription={formatSets(exercise)}
              completed={isDone}
              onToggle={
                onToggleExercise && exId != null
                  ? () => onToggleExercise(exId)
                  : undefined
              }
            />
          )
        })}

        {/* Bulk CTA — "Mark whole day done" / "Done" label */}
        {showBulkCta && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation()
              if (!sessionComplete && !isWholeDayPending) {
                onMarkWholeDayComplete!()
              }
            }}
            disabled={sessionComplete || isWholeDayPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: sessionComplete || isWholeDayPending }}
            style={({ pressed }) => [
              styles.bulkCta,
              {
                backgroundColor: sessionComplete
                  ? colors.green + '22'
                  : colors.gold + '22',
                borderColor: sessionComplete ? colors.green : colors.gold,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            {isWholeDayPending ? (
              <ActivityIndicator size="small" color={colors.gold} />
            ) : (
              <>
                {sessionComplete && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.green} style={styles.ctaIcon} />
                )}
                <Text
                  style={[
                    styles.bulkCtaLabel,
                    { color: sessionComplete ? colors.green : colors.gold },
                  ]}
                >
                  {sessionComplete
                    ? t('today.trainingCompleteLabel')
                    : t('today.markWholeDayDone')}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* Per-session CTA footer — sits below the exercise list, above the card edge */}
      {sessionCtaFooter}
    </>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('today.trainingCardA11yLabel', { name: session.name ?? '' })}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.bg2, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        {cardContent}
      </Pressable>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {cardContent}
    </View>
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
    fontWeight: '600',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  sessionName: {
    ...Type.title2,
    letterSpacing: -0.3,
  },
  sessionCheckbox: {
    paddingTop: 2,
    flexShrink: 0,
  },
  subtitle: {
    ...Type.footnote,
    opacity: 0.7,
    marginTop: 2,
  },
  muscleGroups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  muscleChipLabel: {
    ...Type.caption2,
    fontWeight: '600',
  },
  ringContainer: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  body: {
    padding: 16,
  },
  bulkCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 6,
  },
  ctaIcon: {
    flexShrink: 0,
  },
  bulkCtaLabel: {
    ...Type.callout,
    fontWeight: '600',
  },
  // ── Per-session CTA footer ──────────────────────────────────────────────────
  ctaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Hairline separator between exercise list and CTA footer
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ctaFooterButton: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  primaryCtaButton: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryCtaLabel: {
    ...Type.callout,
    fontWeight: '700',
  },
  finishedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  finishedCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  finishedLabel: {
    ...Type.footnote,
    fontWeight: '600',
  },
  viewSummaryLink: {
    ...Type.footnote,
    fontWeight: '600',
  },
})

export default TrainingCard
