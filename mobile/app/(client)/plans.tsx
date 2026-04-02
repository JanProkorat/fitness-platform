import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Badge } from '@/components/ui/Badge'
import { WeekStrip } from '@/components/ui/WeekStrip'
import { useAuthStore } from '../../src/stores/auth'
import {
  getFullPlan,
  type FullPlanResponse,
} from '../../src/api/nutrition'
import {
  getTodaySession,
  type TodayTrainingResponse,
} from '../../src/api/training'

type DayStatus = 'done' | 'today' | 'future' | 'rest'

// ─── Segmented Control ────────────────────────────────────────────────

function SegmentedControl({
  segments,
  selected,
  onSelect,
}: {
  segments: string[]
  selected: number
  onSelect: (idx: number) => void
}) {
  const colors = useTheme()

  return (
    <View style={[styles.segmented, { backgroundColor: colors.fill }]}>
      {segments.map((label, idx) => {
        const active = idx === selected
        return (
          <Pressable
            key={label}
            onPress={() => onSelect(idx)}
            style={[
              styles.segment,
              active && { backgroundColor: colors.bg2 },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.label : colors.label2 },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Training Plan Card ───────────────────────────────────────────────

function TrainingPlanCard({
  training,
  onPress,
}: {
  training: TodayTrainingResponse
  onPress: () => void
}) {
  const colors = useTheme()

  const currentDay = new Date().getDay()
  const todayIdx = currentDay === 0 ? 6 : currentDay - 1

  const weekDays: DayStatus[] = Array.from({ length: 7 }, (_, i) => {
    if (i < todayIdx) return 'done'
    if (i === todayIdx) return 'today'
    return 'future'
  })

  const weekProgress =
    training.currentWeek != null && training.totalWeeks != null && training.totalWeeks > 0
      ? training.currentWeek / training.totalWeeks
      : 0

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.planCard, { backgroundColor: colors.bg2 }]}>
        {/* Hero */}
        <View style={[styles.planHero, { backgroundColor: '#1a2640' }]}>
          <Badge label="Active" variant="active" />
          <Text style={styles.planName}>{training.planName ?? 'Training Plan'}</Text>
          {training.currentWeek != null && training.totalWeeks != null && (
            <>
              <Text style={styles.planMeta}>
                Week {training.currentWeek} of {training.totalWeeks}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(weekProgress, 1) * 100}%`,
                      backgroundColor: colors.gold,
                    },
                  ]}
                />
              </View>
            </>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {training.session ? '1' : '0'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>today</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {training.currentWeek ?? '—'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>week</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {training.totalWeeks ?? '—'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>total</Text>
          </View>
        </View>

        {/* Week strip */}
        <View style={styles.weekStripWrap}>
          <WeekStrip days={weekDays} />
        </View>
      </View>
    </Pressable>
  )
}

// ─── Nutrition Plan Card ──────────────────────────────────────────────

function NutritionPlanCard({
  plan,
  onPress,
}: {
  plan: FullPlanResponse
  onPress: () => void
}) {
  const colors = useTheme()

  const weekProgress =
    plan.currentWeek != null && plan.totalWeeks > 0
      ? plan.currentWeek / plan.totalWeeks
      : 0

  const currentDay = new Date().getDay()
  const todayIdx = currentDay === 0 ? 6 : currentDay - 1

  const weekDays: DayStatus[] = Array.from({ length: 7 }, (_, i) => {
    if (i < todayIdx) return 'done'
    if (i === todayIdx) return 'today'
    return 'future'
  })

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.planCard, { backgroundColor: colors.bg2 }]}>
        {/* Hero */}
        <View style={[styles.planHero, { backgroundColor: '#1a3340' }]}>
          <Badge label="Active" variant="active" />
          <Text style={styles.planName}>{plan.planName}</Text>
          {plan.currentWeek != null && (
            <>
              <Text style={styles.planMeta}>
                Week {plan.currentWeek} of {plan.totalWeeks}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(weekProgress, 1) * 100}%`,
                      backgroundColor: colors.gold,
                    },
                  ]}
                />
              </View>
            </>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.publishedWeekCount}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>published</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.currentWeek ?? '—'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>week</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.totalWeeks}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>total</Text>
          </View>
        </View>

        {/* Week strip */}
        <View style={styles.weekStripWrap}>
          <WeekStrip days={weekDays} />
        </View>
      </View>
    </Pressable>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function PlansScreen() {
  const colors = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasTrainer = useAuthStore((s) => s.user?.hasActiveLink ?? false)
  const [tab, setTab] = useState(0)

  const nutritionQuery = useQuery({
    queryKey: ['nutrition-full-plan'],
    queryFn: getFullPlan,
    enabled: hasTrainer,
  })

  const trainingQuery = useQuery({
    queryKey: ['today-training'],
    queryFn: getTodaySession,
    enabled: hasTrainer,
  })

  const isLoading = nutritionQuery.isLoading || trainingQuery.isLoading
  const isRefreshing = nutritionQuery.isRefetching || trainingQuery.isRefetching

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['nutrition-full-plan'] })
    queryClient.invalidateQueries({ queryKey: ['today-training'] })
  }, [queryClient])

  const hasTrainingPlan = trainingQuery.data?.planId != null
  const hasNutritionPlan = nutritionQuery.data != null && !nutritionQuery.isError
  const hasAnyPlan = hasTrainingPlan || hasNutritionPlan

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>Plans</Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={['Active', 'Archive']}
          selected={tab}
          onSelect={setTab}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {tab === 0 ? (
            <>
              {!hasTrainer && (
                <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
                  <Text style={{ fontSize: 40 }}>📋</Text>
                  <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                    No plans yet
                  </Text>
                  <Text
                    style={[
                      Type.subheadline,
                      { color: colors.label2, marginTop: 4, textAlign: 'center' },
                    ]}
                  >
                    Connect with a trainer to receive personalised training and nutrition plans.
                  </Text>
                </View>
              )}

              {hasTrainer && !hasAnyPlan && (
                <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
                  <Text style={{ fontSize: 40 }}>⏳</Text>
                  <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                    Plans on the way
                  </Text>
                  <Text
                    style={[
                      Type.subheadline,
                      { color: colors.label2, marginTop: 4, textAlign: 'center' },
                    ]}
                  >
                    Your trainer hasn't created any plans yet. Check back soon!
                  </Text>
                </View>
              )}

              {hasTrainingPlan && trainingQuery.data && (
                <View style={styles.cardWrap}>
                  <Text style={[Type.footnote, { color: colors.label3, marginBottom: 8, marginLeft: 4 }]}>
                    TRAINING
                  </Text>
                  <TrainingPlanCard
                    training={trainingQuery.data}
                    onPress={() =>
                      router.push({
                        pathname: '/(client)/plans/[planId]',
                        params: { planId: trainingQuery.data!.planId!, type: 'training' },
                      } as never)
                    }
                  />
                </View>
              )}

              {hasNutritionPlan && nutritionQuery.data && (
                <View style={styles.cardWrap}>
                  <Text style={[Type.footnote, { color: colors.label3, marginBottom: 8, marginLeft: 4 }]}>
                    NUTRITION
                  </Text>
                  <NutritionPlanCard
                    plan={nutritionQuery.data}
                    onPress={() =>
                      router.push({
                        pathname: '/(client)/plans/[planId]',
                        params: { planId: nutritionQuery.data!.planId, type: 'nutrition' },
                      } as never)
                    }
                  />
                </View>
              )}
            </>
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
              <Text style={{ fontSize: 40 }}>📁</Text>
              <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                No archived plans
              </Text>
              <Text
                style={[
                  Type.subheadline,
                  { color: colors.label2, marginTop: 4, textAlign: 'center' },
                ]}
              >
                Completed plans will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  segmentWrap: {
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
  cardWrap: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  planCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  planHero: {
    padding: 16,
    gap: 6,
  },
  planName: {
    ...Type.title2,
    color: '#ffffff',
    marginTop: 4,
  },
  planMeta: {
    ...Type.caption1,
    color: 'rgba(255,255,255,0.6)',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    ...Type.title3,
  },
  statDesc: {
    ...Type.caption2,
    marginTop: 2,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  weekStripWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emptyCard: {
    margin: 16,
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
  },
  // Segmented control
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm - 2,
    alignItems: 'center',
  },
  segmentText: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})
