import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { ExerciseRow } from '@/components/training/ExerciseRow'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import type { TrainingSession, MuscleGroup } from '@/api/training'

interface TrainingCardProps {
  /** Eyebrow text shown above the session name (e.g. "Plan name · Week 3"). */
  planName: string
  session: TrainingSession
  /**
   * Number of completed exercises.
   * Stays at 0 for the Today card — completion mutations are wired in issue #4.
   */
  completedExercises?: number
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
   *
   * Wiring the full muscle-group list from the today-session response is tracked
   * separately — supply non-empty data here once the backend exposes it.
   */
  muscleGroups?: MuscleGroup[]
  /**
   * When provided, the whole card becomes tappable and navigates to the live
   * session screen for set-logging.
   *
   * Omit (or pass undefined) to render the card as a non-interactive view —
   * useful in plan-detail contexts where the card is display-only.
   *
   * Completion actions (marking sets / the whole session done) belong to
   * issue #4 and will be wired via a separate `onContinue` prop at that point.
   */
  onPress?: () => void
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
  completedExercises = 0,
  estimatedDurationMinutes,
  muscleGroups = [],
  onPress,
}: TrainingCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const exercises = session.exercises ?? []
  const totalExercises = exercises.length

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

            {/* Headline: session name */}
            <Text style={[styles.sessionName, { color: colors.onAccent }]} numberOfLines={2}>
              {session.name}
            </Text>

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
        {exercises.map((exercise, idx) => (
          <ExerciseRow
            key={exercise.exerciseExternalId ?? idx}
            name={exercise.exerciseName ?? ''}
            setsDescription={formatSets(exercise)}
          />
        ))}
        {/* No CTA button on the today read-only card.
            "Označit celý trénink jako splněno" and set-level interactions
            are completion actions belonging to issue #4. */}
      </View>
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
  sessionName: {
    ...Type.title2,
    letterSpacing: -0.3,
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
})

export default TrainingCard
