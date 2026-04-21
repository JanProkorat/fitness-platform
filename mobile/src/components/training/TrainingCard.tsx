import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ExpandableSessionCard } from '@/components/training/ExpandableSessionCard'
import { ExpandableExerciseCard } from '@/components/training/ExpandableExerciseCard'
import { SetGrid } from '@/components/training/SetGrid'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import type { TrainingSession, MuscleGroup } from '@/api/training'
import type { SessionCtaState } from './trainingCardHelpers'

interface TrainingCardProps {
  /** Eyebrow text shown above the aggregate headline (e.g. "Plan name · Week 3"). */
  planName: string
  /** All sessions scheduled for today, ordered by `order`. */
  sessions: TrainingSession[]
  /**
   * Per-session completed-exercise IDs, keyed by sessionId.
   * Derived from the optimistic mutation cache.
   */
  completedIdsBySession: Record<string, ReadonlySet<string>>
  /**
   * Per-session "is the whole session complete" flags, keyed by sessionId.
   */
  sessionCompleteMap: Record<string, boolean>
  /** Called when the user taps a per-exercise checkbox. */
  onToggleExercise?: (sessionId: string, exerciseExternalId: string) => void
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
}

function SessionCtaFooter({ session, state, isPending, onPress }: SessionCtaFooterProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View style={ctaStyles.footerButton}>
      <Pressable
        onPress={() => {
          if (!isPending) onPress(session, state)
        }}
        disabled={isPending}
        accessibilityRole="button"
        accessibilityState={{ disabled: isPending }}
        style={({ pressed }) => [
          ctaStyles.primaryButton,
          { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {isPending ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Text style={[ctaStyles.primaryLabel, { color: colors.onAccent }]}>
            {state === 'in-progress'
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
    fontWeight: '700',
  },
})

// ─── TrainingCard ─────────────────────────────────────────────────────────────

export function TrainingCard({
  planName,
  sessions,
  completedIdsBySession,
  sessionCompleteMap,
  onToggleExercise,
  onToggleSession,
  sessionCtaStateBySession,
  onSessionCta,
  isSessionCtaPending,
  exerciseMuscleGroups = {},
  completedSetsBySessionExercise = {},
}: TrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // Aggregate exercise counts across all sessions for the hero ring.
  const totalExercises = sessions.reduce(
    (sum, s) => sum + (s.exercises ?? []).filter((e) => e.exerciseExternalId != null).length,
    0,
  )
  const completedExercises = sessions.reduce((sum, s) => {
    if (!s.sessionId) return sum
    const ids = completedIdsBySession[s.sessionId] ?? new Set<string>()
    return sum + ids.size
  }, 0)

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
  const heroHeadline = t('today.sessionsCount', { count: sessions.length })
  // Hero subtitle: "M cviků"
  const heroSubtitle = t('today.exercisesCount', { count: totalExercises })

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

            {/* Subtitle: total exercises */}
            <Text style={[styles.subtitle, { color: colors.onAccent }]}>
              {heroSubtitle}
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

          {/* Progress ring: total completed / total exercises */}
          <View style={styles.ringContainer}>
            <ProgressRing
              current={completedExercises}
              total={totalExercises}
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
          const completedIds = completedIdsBySession[sessionId] ?? new Set<string>()
          const isComplete = sessionCompleteMap[sessionId] ?? false
          const exercises = session.exercises ?? []

          // Session summary text: "N cviků"
          const trackableCount = exercises.filter((e) => e.exerciseExternalId != null).length
          const sessionSummary = t('today.exercisesCount', { count: trackableCount })

          // Per-session CTA — hide entirely when the session is finished;
          // completion is already surfaced by the session-level checkbox.
          const ctaState = sessionCtaStateBySession?.[sessionId]
          const showCta =
            ctaState != null && ctaState !== 'finished' && onSessionCta != null
          const ctaPending = isSessionCtaPending?.(sessionId) ?? false

          // Session-level checkbox injected into the session card header.
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
            >
              <Ionicons
                name={isComplete ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={isComplete ? colors.green : colors.label3}
              />
            </Pressable>
          ) : undefined

          return (
            <ExpandableSessionCard
              key={sessionId}
              order={idx + 1}
              name={session.name ?? ''}
              summaryText={sessionSummary}
              completedCount={completedIds.size}
              totalCount={trackableCount}
              headerRight={sessionCheckbox}
            >
              {/* Exercise cards */}
              {exercises.map((exercise, exIdx) => {
                const exId = exercise.exerciseExternalId ?? null
                const isDone = exId != null && completedIds.has(exId)
                const sets = exercise.sets ?? []
                const completedSetNumbers =
                  exId != null
                    ? (completedSetsBySessionExercise[sessionId]?.[exId] ?? [])
                    : []

                // Exercise summary: "N série · M opak · K kg"
                const setCount = sets.length
                const firstReps = sets[0]?.reps
                const firstWeight = sets[0]?.weightKg
                const exSummaryParts: string[] = [`${setCount} ${t('training.set').toLowerCase()}`]
                if (firstReps != null) exSummaryParts.push(`${firstReps} ${t('training.reps').toLowerCase()}`)
                if (firstWeight != null) exSummaryParts.push(`${firstWeight} kg`)

                // Dot color: first muscle group for this exercise, or neutral grey fallback.
                const exMuscleGroups = exId != null ? (exerciseMuscleGroups[exId] ?? []) : []
                const primaryMg = exMuscleGroups[0]
                const dotColor = primaryMg != null
                  ? getMuscleGroupColor(primaryMg, colors)
                  : colors.label3

                return (
                  <ExpandableExerciseCard
                    key={exId ?? exIdx}
                    name={exercise.exerciseName ?? ''}
                    summaryText={exSummaryParts.join(' · ')}
                    dotColor={dotColor}
                    isCompleted={isDone}
                    defaultExpanded
                    nested
                    nestedFirst={exIdx === 0}
                    onToggle={
                      onToggleExercise && exId != null
                        ? () => onToggleExercise(sessionId, exId)
                        : undefined
                    }
                  >
                    <SetGrid sets={sets} completedSetNumbers={completedSetNumbers} />
                    {exercise.notes ? (
                      <View
                        style={[
                          styles.exerciseNote,
                          {
                            backgroundColor: colors.gold + '0a',
                            borderTopColor: colors.sep2,
                          },
                        ]}
                      >
                        <Text style={[Type.caption1, { color: colors.label2, lineHeight: 18 }]}>
                          <Text style={{ fontWeight: '600', color: colors.gold }}>
                            {t('today.exerciseNoteLabel')}{' '}
                          </Text>
                          {exercise.notes}
                        </Text>
                      </View>
                    ) : null}
                  </ExpandableExerciseCard>
                )
              })}

              {/* Per-session CTA footer */}
              {showCta && (
                <SessionCtaFooter
                  session={session}
                  state={ctaState}
                  isPending={ctaPending}
                  onPress={onSessionCta}
                />
              )}
            </ExpandableSessionCard>
          )
        })}
      </View>
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
  sessionName: {
    ...Type.title2,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...Type.footnote,
    opacity: 0.7,
    marginTop: 2,
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
    fontWeight: '600',
  },
  ringContainer: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  body: {
    padding: 12,
    gap: 0,
  },
  exerciseNote: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})

export default TrainingCard
