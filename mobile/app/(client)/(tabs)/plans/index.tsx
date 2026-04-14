import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { href, hrefParams } from '@/lib/navigation'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { WeekStrip } from '@/components/ui/WeekStrip'
import { useAuthStore } from '@/stores/auth'
import {
  getFullPlan,
  getClientPlans,
  type FullPlanResponse,
  type ClientPlanSummary,
  type PlanStatus,
} from '@/api/nutrition'
import {
  getTodaySession,
  type TodayTrainingResponse,
} from '@/api/training'
import {
  getCollaborations,
  type CollaborationDto,
} from '@/api/profile'

type DayStatus = 'done' | 'today' | 'future' | 'rest'

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(isoDate: string | null): string {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

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
  trainerName,
  onPress,
}: {
  training: TodayTrainingResponse
  trainerName?: string
  onPress: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

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

  const planStatus = training.status ?? 'Active'
  const isCompleted = planStatus === 'Completed'

  const subtitleParts: string[] = []
  if (training.totalWeeks) subtitleParts.push(t('plans.weeksCount', { count: training.totalWeeks }))
  if (trainerName) subtitleParts.push(trainerName)
  const subtitle = subtitleParts.join(' · ')

  const gradientColors: [string, string] = isCompleted
    ? ['#2a2a2e', '#2a2a2e']
    : ['#1a1a2e', '#16213e']

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.planCard, { backgroundColor: colors.bg2 }]}>
        {/* Hero with gradient */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.planHero, isCompleted && { opacity: 0.85 }]}
        >
          {/* Status tag — absolute top-right */}
          <View
            style={[
              styles.statusTag,
              {
                backgroundColor: isCompleted
                  ? 'rgba(201,168,76,0.2)'
                  : 'rgba(52,199,89,0.2)',
              },
            ]}
          >
            <Text
              style={[
                styles.statusTagText,
                { color: isCompleted ? colors.gold : '#34c759' },
              ]}
            >
              {isCompleted ? `✓ ${t('plans.completed')}` : `● ${t('plans.statusActive')}`}
            </Text>
          </View>

          {/* Type label */}
          <Text style={styles.planTypeLabel}>{t('plans.trainingPlanType')}</Text>

          {/* Plan name */}
          <Text style={styles.planName}>{training.planName ?? t('today.trainingPlan')}</Text>

          {/* Subtitle */}
          {subtitle.length > 0 && <Text style={styles.planSubtitle}>{subtitle}</Text>}

          {/* Progress bar */}
          {training.currentWeek != null && training.totalWeeks != null && (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(isCompleted ? 1 : weekProgress, 1) * 100}%`,
                      backgroundColor: isCompleted ? colors.green : colors.gold,
                    },
                  ]}
                />
              </View>
              <Text style={styles.planProgressLabel}>
                {t('plans.weekOf', { current: training.currentWeek, total: training.totalWeeks })}
              </Text>
            </>
          )}

          {isCompleted && training.dateCompleted && (
            <Text style={styles.planProgressLabel}>
              {t('plans.completedOn', { date: formatDate(training.dateCompleted) })}
            </Text>
          )}
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {training.currentWeek ?? '—'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.weekLabel')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {training.totalWeeks ?? '—'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.totalWeeksLabel')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.green }]}>
              {training.session ? t('plans.yes') : '—'}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.todaySession')}</Text>
          </View>
        </View>

        {/* Week strip (only for active plans) */}
        {!isCompleted && (
          <View style={styles.weekStripSection}>
            <Text style={[styles.weekStripHeader, { color: colors.label2 }]}>
              {t('plans.thisWeek')}
            </Text>
            <WeekStrip days={weekDays} />
          </View>
        )}

      </View>
    </Pressable>
  )
}

// ─── Nutrition Plan Card ──────────────────────────────────────────────

function NutritionPlanCard({
  plan,
  trainerName,
  onPress,
}: {
  plan: FullPlanResponse
  trainerName?: string
  onPress: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const planStatus = plan.status ?? 'Active'
  const isCompleted = planStatus === 'Completed'

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

  const dailyKcal = plan.globalSettings?.dailyKcal ?? 0

  const subtitleParts: string[] = []
  if (dailyKcal > 0) subtitleParts.push(`${dailyKcal} kcal`)
  if (plan.totalWeeks > 0) subtitleParts.push(t('plans.weeksCount', { count: plan.totalWeeks }))
  if (trainerName) subtitleParts.push(trainerName)
  const subtitle = subtitleParts.join(' · ')

  const gradientColors: [string, string] = isCompleted
    ? ['#2a2a2e', '#2a2a2e']
    : [colors.nutritionHeroStart, colors.nutritionHeroEnd]

  // Compute days completed & compliance from plan + eaten data
  const eatenSet = useMemo(() => new Set(plan.eatenMealIds ?? []), [plan.eatenMealIds])

  const { daysCompleted, compliancePercent } = useMemo(() => {
    const allMealIds = new Set<string>()
    // Group meals by day to count days with at least one eaten meal
    let daysWithEaten = 0
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    for (const week of plan.weeks) {
      const weekStart = week.weekStartDate ? new Date(week.weekStartDate) : null
      for (let dayIdx = 0; dayIdx < week.days.length; dayIdx++) {
        const day = week.days[dayIdx]
        // Only count days up to today
        if (weekStart) {
          const dayDate = new Date(weekStart)
          dayDate.setDate(dayDate.getDate() + dayIdx)
          if (dayDate > today) continue
        }
        for (const meal of day.meals) {
          allMealIds.add(meal.mealId)
        }
        const dayHasEaten = day.meals.some((m) => eatenSet.has(m.mealId))
        if (dayHasEaten) daysWithEaten++
      }
    }

    const totalPlanned = allMealIds.size
    const totalEaten = [...allMealIds].filter((id) => eatenSet.has(id)).length
    const compliance = totalPlanned > 0
      ? Math.round((totalEaten / totalPlanned) * 100)
      : 0

    return { daysCompleted: daysWithEaten, compliancePercent: compliance }
  }, [plan.weeks, eatenSet])

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.planCard, { backgroundColor: colors.bg2 }]}>
        {/* Hero with gradient */}
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.planHero, isCompleted && { opacity: 0.85 }]}
        >
          {/* Status tag — absolute top-right */}
          <View
            style={[
              styles.statusTag,
              {
                backgroundColor: isCompleted
                  ? 'rgba(201,168,76,0.2)'
                  : 'rgba(52,199,89,0.2)',
              },
            ]}
          >
            <Text
              style={[
                styles.statusTagText,
                { color: isCompleted ? colors.gold : '#34c759' },
              ]}
            >
              {isCompleted ? `✓ ${t('plans.completed')}` : `● ${t('plans.statusActive')}`}
            </Text>
          </View>

          {/* Type label */}
          <Text style={styles.planTypeLabel}>{t('plans.nutritionPlanType')}</Text>

          {/* Plan name */}
          <Text style={styles.planName}>{plan.planName}</Text>

          {/* Subtitle: kcal · weeks · trainer */}
          {subtitle.length > 0 && <Text style={styles.planSubtitle}>{subtitle}</Text>}

          {/* Progress bar */}
          {plan.currentWeek != null && (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(isCompleted ? 1 : weekProgress, 1) * 100}%`,
                      backgroundColor: isCompleted ? colors.green : colors.gold,
                    },
                  ]}
                />
              </View>
              <Text style={styles.planProgressLabel}>
                {t('plans.weekOf', { current: plan.currentWeek, total: plan.totalWeeks })}
                {dailyKcal > 0
                  ? ` · ${t('plans.avgKcal', { kcal: dailyKcal })}`
                  : ''}
              </Text>
            </>
          )}

          {isCompleted && plan.dateCompleted && (
            <Text style={styles.planProgressLabel}>
              {t('plans.completedOn', { date: formatDate(plan.dateCompleted) })}
            </Text>
          )}
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {daysCompleted}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.daysCompleted')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: compliancePercent >= 80 ? colors.green : colors.label }]}>
              {`${compliancePercent} %`}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.compliance')}</Text>
          </View>
        </View>

      </View>
    </Pressable>
  )
}

// ─── Completed Plan Summary Card ──────────────────────────────────────

function CompletedPlanCard({
  plan,
  onPress,
}: {
  plan: ClientPlanSummary
  onPress: () => void
}) {
  const colors = useTheme()
  const { t } = useTranslation()

  const isTraining = plan.type === 'training'
  const gradientColors: [string, string] = isTraining
    ? ['#1a1a2e', '#16213e']
    : [colors.nutritionHeroStart, colors.nutritionHeroEnd]

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
      <View style={[styles.planCard, { backgroundColor: colors.bg2 }]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.planHero, { opacity: 0.85 }]}
        >
          {/* Status tag — absolute top-right */}
          <View style={[styles.statusTag, { backgroundColor: 'rgba(201,168,76,0.2)' }]}>
            <Text style={[styles.statusTagText, { color: colors.gold }]}>
              {`✓ ${t('plans.completed')}`}
            </Text>
          </View>

          {/* Type label */}
          <Text style={styles.planTypeLabel}>
            {isTraining ? t('plans.trainingPlanType') : t('plans.nutritionPlanType')}
          </Text>

          {/* Plan name */}
          <Text style={styles.planName}>{plan.planName}</Text>

          {/* Subtitle */}
          <Text style={styles.planSubtitle}>
            {[
              plan.totalWeeks > 0 ? t('plans.weeksCount', { count: plan.totalWeeks }) : null,
              plan.dateCompleted ? t('plans.completedOn', { date: formatDate(plan.dateCompleted) }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>

          {/* Full progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: '100%', backgroundColor: colors.gold }]}
            />
          </View>
          <Text style={styles.planProgressLabel}>
            {t('plans.weekOf', { current: plan.totalWeeks, total: plan.totalWeeks })} ✓
          </Text>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.publishedWeekCount}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.published')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.totalWeeks}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.totalWeeksLabel')}</Text>
          </View>
        </View>

      </View>
    </Pressable>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function PlansScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
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

  // Collaboration data for trainer name in subtitle
  const collabQuery = useQuery<CollaborationDto[]>({
    queryKey: ['collaborations'],
    queryFn: getCollaborations,
    enabled: hasTrainer,
  })

  const trainerName = useMemo(() => {
    const trainer = collabQuery.data?.find((c) => c.role === 'Trainer')
    return trainer?.professionalName ?? undefined
  }, [collabQuery.data])

  const nutritionistName = useMemo(() => {
    const nutritionist = collabQuery.data?.find((c) => c.role === 'Nutritionist')
    return nutritionist?.professionalName ?? undefined
  }, [collabQuery.data])

  // Archive tab: fetch completed plans
  const archiveQuery = useQuery({
    queryKey: ['client-plans-completed'],
    queryFn: () => getClientPlans('Completed'),
    enabled: hasTrainer && tab === 1,
  })

  const isLoading =
    tab === 0
      ? nutritionQuery.isLoading || trainingQuery.isLoading
      : archiveQuery.isLoading
  const isRefreshing =
    tab === 0
      ? nutritionQuery.isRefetching || trainingQuery.isRefetching
      : archiveQuery.isRefetching

  const onRefresh = useCallback(() => {
    if (tab === 0) {
      queryClient.invalidateQueries({ queryKey: ['nutrition-full-plan'] })
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['client-plans-completed'] })
    }
  }, [queryClient, tab])

  const hasTrainingPlan = trainingQuery.data?.planId != null
  const hasNutritionPlan = nutritionQuery.data != null && !nutritionQuery.isError
  const hasAnyPlan = hasTrainingPlan || hasNutritionPlan

  const archivedPlans = archiveQuery.data?.items ?? []

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>{t('plans.title')}</Text>
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={[t('plans.active'), t('plans.archive')]}
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
                    {t('plans.noPlans')}
                  </Text>
                  <Text
                    style={[
                      Type.subheadline,
                      { color: colors.label2, marginTop: 4, textAlign: 'center' },
                    ]}
                  >
                    {t('plans.noPlansDesc')}
                  </Text>
                </View>
              )}

              {hasTrainer && !hasAnyPlan && (
                <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
                  <Text style={{ fontSize: 40 }}>⏳</Text>
                  <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                    {t('plans.plansOnTheWay')}
                  </Text>
                  <Text
                    style={[
                      Type.subheadline,
                      { color: colors.label2, marginTop: 4, textAlign: 'center' },
                    ]}
                  >
                    {t('plans.plansOnTheWayDesc')}
                  </Text>
                </View>
              )}

              {hasTrainingPlan && trainingQuery.data && (
                <View style={styles.cardWrap}>
                  <TrainingPlanCard
                    training={trainingQuery.data}
                    trainerName={trainerName}
                    onPress={() =>
                      router.push(hrefParams('/(client)/plans/[planId]', { planId: trainingQuery.data!.planId!, type: 'training' }))
                    }
                  />
                </View>
              )}

              {hasNutritionPlan && nutritionQuery.data && (
                <View style={styles.cardWrap}>
                  <NutritionPlanCard
                    plan={nutritionQuery.data}
                    trainerName={nutritionistName}
                    onPress={() =>
                      router.push(href('/(client)/plans/plan-detail'))
                    }
                  />
                </View>
              )}
            </>
          ) : (
            <>
              {archivedPlans.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.bg2 }]}>
                  <Text style={{ fontSize: 40 }}>📁</Text>
                  <Text style={[Type.headline, { color: colors.label, marginTop: 12 }]}>
                    {t('plans.noArchived')}
                  </Text>
                  <Text
                    style={[
                      Type.subheadline,
                      { color: colors.label2, marginTop: 4, textAlign: 'center' },
                    ]}
                  >
                    {t('plans.noArchivedDesc')}
                  </Text>
                </View>
              ) : (
                archivedPlans.map((plan) => (
                  <View key={plan.planId} style={styles.cardWrap}>
                    <CompletedPlanCard
                      plan={plan}
                      onPress={() =>
                        router.push(hrefParams('/(client)/plans/[planId]', { planId: plan.planId, type: plan.type }))
                      }
                    />
                  </View>
                ))
              )}
            </>
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
    padding: 20,
    paddingTop: 20,
  },
  statusTag: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  planTypeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  planSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 3,
  },
  planProgressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginTop: 12,
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
  weekStripSection: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  weekStripHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
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
