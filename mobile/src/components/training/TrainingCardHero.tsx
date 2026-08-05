import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type, interFamily } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import type { TrainingSession, MuscleGroup } from '@/api/training'

// ─── TrainingCardHero ─────────────────────────────────────────────────────────

interface TrainingCardHeroProps {
  /** Eyebrow text shown above the aggregate headline (e.g. "Plan name · Week 3"). */
  planName: string
  /** All sessions scheduled for today, ordered by `order`. */
  sessions: TrainingSession[]
  /**
   * Map from exerciseExternalId to its muscle groups, sourced from the backend's
   * `GetTodaySessionResponse.exerciseMuscleGroups` field. Used to render colored
   * muscle-group chips in the hero.
   */
  exerciseMuscleGroups: Record<string, MuscleGroup[]>
  /**
   * Per-session "is the whole session complete" flags, keyed by sessionId.
   */
  sessionCompleteMap: Record<string, boolean>
}

export function TrainingCardHero({
  planName,
  sessions,
  exerciseMuscleGroups,
  sessionCompleteMap,
}: TrainingCardHeroProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // Aggregate training-session counts for the hero ring. The ring tracks how
  // many of today's training sessions the client has fully completed (via
  // the per-session checkbox / live runner finish flow).
  const totalSessions = sessions.length
  const completedSessions = sessions.reduce((sum, s) => {
    if (!s.sessionId) return sum
    return sum + (sessionCompleteMap[s.sessionId] ? 1 : 0)
  }, 0)

  // Deduplicated muscle groups across all exercises (first-seen order).
  const aggregatedMuscleGroups = useMemo<MuscleGroup[]>(() => {
    const seen = new Set<MuscleGroup>()
    const result: MuscleGroup[] = []
    for (const session of sessions) {
      // allExercises is the flat, computed union of every exercise in the
      // session (standalone + every workout's nested exercises). Order
      // doesn't matter here — this is a deduplicated muscle-group set, not
      // an ordered render — so the flat field is safe to use directly.
      for (const ex of session.allExercises ?? []) {
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
  )
}

const styles = StyleSheet.create({
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
})

export default TrainingCardHero
