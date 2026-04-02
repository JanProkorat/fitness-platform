import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Badge } from '@/components/ui/Badge'
import { GoldButton } from '@/components/ui/GoldButton'
import { ExerciseRow } from '@/components/training/ExerciseRow'
import type { TrainingSession } from '@/api/training'

interface TrainingCardProps {
  planName: string
  session: TrainingSession
  completedSets?: number
  totalSets?: number
  onContinue?: () => void
}

function formatSets(exercise: TrainingSession['exercises'][number]): string {
  const setCount = exercise.sets.length
  const reps = exercise.sets[0]?.reps
  if (reps) return `${setCount} x ${reps}`
  return `${setCount} sets`
}

export function TrainingCard({
  planName,
  session,
  completedSets = 0,
  totalSets = 0,
  onContinue,
}: TrainingCardProps) {
  const colors = useTheme()

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Hero section */}
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={[styles.planName, { color: 'rgba(255,255,255,0.7)' }]}>
            {planName}
          </Text>
          <Text style={styles.sessionName}>{session.name}</Text>
          {totalSets > 0 && (
            <View style={styles.heroBottom}>
              <View style={styles.muscleGroups}>
                <Badge label="Training" variant="gold" />
              </View>
              <ProgressRing
                current={completedSets}
                total={totalSets}
                size={48}
                strokeWidth={4}
                color={colors.gold}
              />
            </View>
          )}
        </View>
      </View>

      {/* Exercise list */}
      <View style={styles.body}>
        {session.exercises.map((exercise, idx) => (
          <ExerciseRow
            key={exercise.exerciseExternalId ?? idx}
            name={exercise.exerciseName}
            setsDescription={formatSets(exercise)}
          />
        ))}
        {onContinue && (
          <GoldButton
            title="Continue training"
            onPress={onContinue}
            style={styles.cta}
          />
        )}
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
    backgroundColor: '#1a2332',
    padding: 16,
  },
  heroContent: {},
  planName: {
    ...Type.caption1,
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionName: {
    ...Type.title2,
    color: '#ffffff',
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  muscleGroups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  body: {
    padding: 16,
  },
  cta: {
    marginTop: 16,
  },
})

export default TrainingCard
