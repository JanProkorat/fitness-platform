import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { MacroBar } from '@/components/ui/MacroBar'
import { SessionChip } from '@/components/training/SessionChip'
import { ExerciseRow } from '@/components/training/ExerciseRow'
import { MealRow } from '@/components/nutrition/MealRow'
import {
  getFullPlan,
  type FullPlanResponse,
  type PlanDay,
} from '../../../src/api/nutrition'
import {
  getTodaySession,
  type TodayTrainingResponse,
} from '../../../src/api/training'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ─── Nutrition Plan Detail ────────────────────────────────────────────

function NutritionPlanDetail({ plan }: { plan: FullPlanResponse }) {
  const colors = useTheme()
  const currentWeekData = plan.weeks.find((w) => w.weekNumber === plan.currentWeek)
  const [selectedDay, setSelectedDay] = useState(plan.currentDayOfWeek ?? 1)

  const weeks = plan.weeks
  const dayData = currentWeekData?.days.find((d) => d.dayOfWeek === selectedDay)
  const meals = useMemo(
    () => [...(dayData?.meals ?? [])].sort((a, b) => a.order - b.order),
    [dayData],
  )

  const settings = plan.globalSettings
  const dayTotals = dayData?.dayTotals

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Week selector */}
      {weeks.length > 1 && (
        <View style={styles.section}>
          <SectionHeader title={`Week ${currentWeekData?.weekNumber ?? '—'}`} />
        </View>
      )}

      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daySelector}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const active = day === selectedDay
          const hasDay = currentWeekData?.days.some((d) => d.dayOfWeek === day)
          return (
            <Pressable
              key={day}
              onPress={() => setSelectedDay(day)}
              style={[
                styles.dayChip,
                {
                  backgroundColor: active ? colors.gold : colors.fill,
                  opacity: hasDay ? 1 : 0.4,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayChipText,
                  { color: active ? '#000' : colors.label2 },
                ]}
              >
                {DAY_NAMES[day - 1]?.slice(0, 3)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Macros */}
      {(settings || dayTotals) && (
        <View style={[styles.macroCard, { backgroundColor: colors.bg2 }]}>
          <MacroBar
            label="Protein"
            current={dayTotals?.protein ?? 0}
            target={settings?.proteinGrams ?? 0}
            color={colors.blue}
          />
          <MacroBar
            label="Carbs"
            current={dayTotals?.carbs ?? 0}
            target={settings?.carbsGrams ?? 0}
            color={colors.orange}
          />
          <MacroBar
            label="Fat"
            current={dayTotals?.fat ?? 0}
            target={settings?.fatGrams ?? 0}
            color={colors.purple}
          />
        </View>
      )}

      {/* Meals */}
      {meals.length > 0 ? (
        <View style={[styles.mealList, { backgroundColor: colors.bg2 }]}>
          {meals.map((meal) => (
            <MealRow
              key={meal.mealId}
              name={meal.name}
              kcal={meal.mealTotals?.kcal ?? 0}
              time={meal.time}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.emptyDay, { backgroundColor: colors.bg2 }]}>
          <Text style={[Type.subheadline, { color: colors.label3 }]}>
            No meals planned for this day
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

// ─── Training Plan Detail ─────────────────────────────────────────────

function TrainingPlanDetail({ training }: { training: TodayTrainingResponse }) {
  const colors = useTheme()
  const session = training.session

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Plan info */}
      <View style={[styles.planInfoCard, { backgroundColor: colors.bg2 }]}>
        <Text style={[Type.headline, { color: colors.label }]}>
          {training.planName ?? 'Training Plan'}
        </Text>
        {training.currentWeek != null && training.totalWeeks != null && (
          <Text style={[Type.subheadline, { color: colors.label2, marginTop: 4 }]}>
            Week {training.currentWeek} of {training.totalWeeks}
          </Text>
        )}
      </View>

      {/* Today's session */}
      {session ? (
        <View style={styles.section}>
          <SectionHeader title="Today's Session" />
          <View style={[styles.sessionCard, { backgroundColor: colors.bg2 }]}>
            <View style={styles.sessionHeader}>
              <SessionChip label={session.name} active />
              <Text style={[Type.caption1, { color: colors.label3 }]}>
                {session.exercises.length} exercises
              </Text>
            </View>
            {session.notes && (
              <Text style={[Type.subheadline, { color: colors.label2, marginBottom: 8 }]}>
                {session.notes}
              </Text>
            )}
            {session.exercises.map((exercise, idx) => {
              const setCount = exercise.sets.length
              const reps = exercise.sets[0]?.reps
              const desc = reps ? `${setCount} x ${reps}` : `${setCount} sets`
              return (
                <ExerciseRow
                  key={exercise.exerciseExternalId ?? idx}
                  name={exercise.exerciseName}
                  setsDescription={desc}
                />
              )
            })}
          </View>
        </View>
      ) : (
        <View style={[styles.emptyDay, { backgroundColor: colors.bg2 }]}>
          <Text style={[Type.headline, { color: colors.label3 }]}>Rest day</Text>
          <Text style={[Type.subheadline, { color: colors.label3, marginTop: 4 }]}>
            No training session scheduled for today.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function PlanDetailScreen() {
  const { planId, type } = useLocalSearchParams<{ planId: string; type?: string }>()
  const colors = useTheme()
  const router = useRouter()

  const isNutrition = type === 'nutrition'

  const nutritionQuery = useQuery({
    queryKey: ['nutrition-full-plan'],
    queryFn: getFullPlan,
    enabled: isNutrition,
  })

  const trainingQuery = useQuery({
    queryKey: ['today-training'],
    queryFn: getTodaySession,
    enabled: !isNutrition,
  })

  const isLoading = isNutrition ? nutritionQuery.isLoading : trainingQuery.isLoading
  const title = isNutrition
    ? nutritionQuery.data?.planName ?? 'Nutrition Plan'
    : trainingQuery.data?.planName ?? 'Training Plan'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Nav bar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
          <Text style={[Type.body, { color: colors.gold }]}>Plans</Text>
        </Pressable>
      </View>

      <View style={styles.titleBar}>
        <Text style={[Type.largeTitle, { color: colors.label }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : isNutrition && nutritionQuery.data ? (
        <NutritionPlanDetail plan={nutritionQuery.data} />
      ) : !isNutrition && trainingQuery.data ? (
        <TrainingPlanDetail training={trainingQuery.data} />
      ) : (
        <View style={styles.centered}>
          <Text style={[Type.headline, { color: colors.label3 }]}>Plan not found</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  titleBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 100,
  },
  section: {
    marginTop: 16,
  },
  // Day selector
  daySelector: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  dayChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  dayChipText: {
    ...Type.caption1,
    fontWeight: '600',
  },
  // Macro card
  macroCard: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: Radius.md,
    padding: 16,
  },
  // Meal list
  mealList: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: Radius.md,
    padding: 16,
  },
  emptyDay: {
    margin: 16,
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
  },
  // Training
  planInfoCard: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    padding: 16,
  },
  sessionCard: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    padding: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
})
