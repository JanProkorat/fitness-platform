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
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { hrefParams, href } from '@/lib/navigation'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useAuthStore } from '@/stores/auth'
import {
  getClientPlans,
  getFullPlan,
  type ClientPlanSummary,
  type FullPlanResponse,
  type PlanStatus,
} from '@/api/nutrition'
import {
  getFullTrainingPlan,
  type GetFullTrainingPlanResponse,
  type SessionDto,
  type WeekDto,
} from '@/api/training'
import {
  getCollaborations,
  type CollaborationDto,
} from '@/api/profile'

// ─── Types ────────────────────────────────────────────────────────────

type PlanTab = 'training' | 'nutrition'

type SessionStatus = 'done' | 'today' | 'planned'

// ─── Helpers ──────────────────────────────────────────────────────────

/** Returns today's day of week as 1=Monday…7=Sunday */
function todayDayOfWeek(): number {
  const d = new Date().getDay()
  return d === 0 ? 7 : d
}

/** Derives session status relative to the current plan week. */
function sessionStatus(
  session: SessionDto,
  isCurrentWeek: boolean,
  planCurrentWeek: number | null | undefined,
  selectedWeek: number,
): SessionStatus {
  if (!isCurrentWeek) {
    // Past weeks are "done", future weeks are "planned"
    return selectedWeek < (planCurrentWeek ?? 0) ? 'done' : 'planned'
  }
  // In the current week: compare dayOfWeek to today
  const today = todayDayOfWeek()
  const dow = session.dayOfWeek ?? 0
  if (dow < today) return 'done'
  if (dow === today) return 'today'
  return 'planned'
}

/** Derives nutrition day status relative to the current plan week/day. */
function dayStatus(
  dayOfWeek: number,
  isCurrentWeek: boolean,
  planCurrentWeek: number | null | undefined,
  selectedWeek: number,
  currentDayOfWeek: number | null | undefined,
): SessionStatus {
  if (!isCurrentWeek) {
    return selectedWeek < (planCurrentWeek ?? 0) ? 'done' : 'planned'
  }
  const today = currentDayOfWeek ?? todayDayOfWeek()
  if (dayOfWeek < today) return 'done'
  if (dayOfWeek === today) return 'today'
  return 'planned'
}

const DAY_LABELS_CS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']

// ─── Plan Hero ────────────────────────────────────────────────────────

function PlanHero({
  plan,
  type,
  professionalName,
  onPress,
  colors,
}: {
  plan: ClientPlanSummary
  type: 'training' | 'nutrition'
  professionalName?: string
  onPress: () => void
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()

  const totalWeeks = plan.totalWeeks ?? 0

  const effectiveCurrentWeek = (() => {
    if (plan.currentWeek != null) {
      return Math.min(plan.currentWeek, totalWeeks || plan.currentWeek)
    }
    if (plan.startDate && totalWeeks > 0) {
      const start = new Date(plan.startDate)
      const today = new Date()
      const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
      if (daysSinceStart < 0) return 0
      const computed = Math.floor(daysSinceStart / 7) + 1
      return Math.min(computed, totalWeeks)
    }
    return 0
  })()

  const weekProgress = totalWeeks > 0 ? effectiveCurrentWeek / totalWeeks : 0

  const subtitleParts: string[] = []
  if (totalWeeks > 0) subtitleParts.push(t('plans.weeksCount', { count: totalWeeks }))
  if (professionalName) subtitleParts.push(professionalName)
  const subtitle = subtitleParts.join(' · ')

  const gradientColors: [string, string] =
    type === 'nutrition'
      ? [colors.nutritionHeroStart, colors.nutritionHeroEnd]
      : ['#1a1a2e', '#16213e']

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [heroStyles.pressable, { opacity: pressed ? 0.9 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={plan.planName ?? ''}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={heroStyles.gradient}
      >
        {/* Active badge */}
        <View style={[heroStyles.badge, { backgroundColor: 'rgba(52,199,89,0.2)' }]}>
          <Text style={[heroStyles.badgeText, { color: colors.green }]}>
            {`● ${t('plans.statusActive')}`}
          </Text>
        </View>

        {/* Type label */}
        <Text style={heroStyles.typeLabel}>
          {type === 'training' ? t('plans.trainingPlanType') : t('plans.nutritionPlanType')}
        </Text>

        {/* Plan name */}
        <Text style={heroStyles.planName}>{plan.planName ?? ''}</Text>

        {/* Subtitle */}
        {subtitle.length > 0 && (
          <Text style={heroStyles.subtitle}>{subtitle}</Text>
        )}

        {/* Progress bar */}
        {totalWeeks > 0 && (
          <>
            <View style={[heroStyles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <View
                style={[
                  heroStyles.progressFill,
                  {
                    width: `${Math.min(weekProgress, 1) * 100}%` as `${number}%`,
                    backgroundColor: colors.gold,
                  },
                ]}
              />
            </View>
            <Text style={heroStyles.progressLabel}>
              {t('plans.weekOf', {
                current: effectiveCurrentWeek,
                total: totalWeeks,
              })}
            </Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  )
}

const heroStyles = StyleSheet.create({
  pressable: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  gradient: {
    padding: 18,
    paddingTop: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },
})

// ─── Week Stepper ─────────────────────────────────────────────────────

function WeekStepper({
  week,
  publishedWeekCount,
  currentPlanWeek,
  onStep,
  colors,
}: {
  week: number
  publishedWeekCount: number
  currentPlanWeek: number | null | undefined
  onStep: (dir: -1 | 1) => void
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()
  const isCurrentWeek = week === (currentPlanWeek ?? -1)
  const label = isCurrentWeek
    ? t('plans.thisWeekLabel')
    : t('plans.weekStepper', { week, total: publishedWeekCount })

  const prevDisabled = week <= 1
  const nextDisabled = week >= publishedWeekCount

  return (
    <View style={[stepperStyles.row, { borderTopColor: colors.sep2, borderBottomColor: colors.sep2 }]}>
      <Pressable
        onPress={() => onStep(-1)}
        disabled={prevDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: prevDisabled }}
        accessibilityLabel={t('common.previous', { defaultValue: 'Previous' })}
        style={[stepperStyles.chevron, prevDisabled && stepperStyles.disabled]}
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={prevDisabled ? colors.label3 : colors.label}
        />
      </Pressable>
      <Text style={[stepperStyles.label, { color: colors.label }]}>{label}</Text>
      <Pressable
        onPress={() => onStep(1)}
        disabled={nextDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: nextDisabled }}
        accessibilityLabel={t('common.next', { defaultValue: 'Next' })}
        style={[stepperStyles.chevron, nextDisabled && stepperStyles.disabled]}
      >
        <Ionicons
          name="chevron-forward"
          size={20}
          color={nextDisabled ? colors.label3 : colors.label}
        />
      </Pressable>
    </View>
  )
}

const stepperStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 0,
  },
  chevron: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.3,
  },
  label: {
    ...Type.subheadline,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
})

// ─── Training Session Row ─────────────────────────────────────────────

function TrainingSessionRow({
  session,
  status,
  onPress,
  colors,
}: {
  session: SessionDto
  status: SessionStatus
  onPress: () => void
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()

  const dayLabel = DAY_LABELS_CS[(session.dayOfWeek ?? 1) - 1] ?? ''
  const totalEx = session.totalExerciseCount ?? 0
  const completedEx = session.completedExerciseCount ?? 0

  const subParts: string[] = []
  if (status === 'today') {
    subParts.push(t('plans.thisWeek'))
  } else {
    subParts.push(dayLabel)
  }
  if (totalEx > 0) {
    subParts.push(t('plans.sessions_other', { count: totalEx }))
  }
  const sub = subParts.join(' · ')

  const iconBg =
    status === 'done'
      ? 'rgba(52,199,89,0.15)'
      : status === 'today'
        ? `rgba(201,168,76,0.18)`
        : colors.fill

  const iconColor =
    status === 'done'
      ? colors.green
      : status === 'today'
        ? colors.gold
        : colors.label3

  const iconChar = status === 'done' ? '✓' : status === 'today' ? '●' : '○'

  const rightLabel =
    status === 'done'
      ? `${completedEx}/${totalEx}`
      : status === 'today'
        ? t('plans.sessionToday')
        : t('plans.sessionPlanned')

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        {
          backgroundColor:
            status === 'today'
              ? `rgba(201,168,76,0.06)`
              : colors.bg2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      {/* Icon */}
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={[rowStyles.iconText, { color: iconColor }]}>{iconChar}</Text>
      </View>

      {/* Body */}
      <View style={rowStyles.body}>
        <Text
          style={[
            rowStyles.title,
            { color: colors.label, fontWeight: status === 'today' ? '600' : '400' },
          ]}
          numberOfLines={1}
        >
          {session.name ?? ''}
        </Text>
        <Text style={[rowStyles.sub, { color: status === 'today' ? colors.gold : colors.label3 }]}>
          {sub}
        </Text>
      </View>

      {/* Right */}
      <View style={rowStyles.right}>
        {status === 'today' ? (
          <View style={[rowStyles.startBtn, { backgroundColor: colors.gold }]}>
            <Text style={[rowStyles.startBtnText, { color: colors.onAccent }]}>{rightLabel}</Text>
          </View>
        ) : (
          <>
            <Text style={[rowStyles.rightText, { color: status === 'done' ? colors.green : colors.label3 }]}>
              {rightLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.label3} />
          </>
        )}
      </View>
    </Pressable>
  )
}

// ─── Nutrition Day Row ────────────────────────────────────────────────

function NutritionDayRow({
  dayOfWeek,
  mealCount,
  status,
  eaten,
  total,
  onPress,
  colors,
}: {
  dayOfWeek: number
  mealCount: number
  status: SessionStatus
  eaten: number
  total: number
  onPress: () => void
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()

  const dayLabel = DAY_LABELS_CS[dayOfWeek - 1] ?? ''
  const sub = status === 'today'
    ? t('plans.thisWeek')
    : t('plans.meals_other', { count: mealCount })

  const iconBg =
    status === 'done'
      ? 'rgba(52,199,89,0.15)'
      : status === 'today'
        ? 'rgba(201,168,76,0.18)'
        : colors.fill

  const iconColor =
    status === 'done'
      ? colors.green
      : status === 'today'
        ? colors.gold
        : colors.label3

  const iconChar = status === 'done' ? '✓' : status === 'today' ? '●' : '○'

  const rightLabel =
    status === 'done'
      ? `${eaten}/${total}`
      : status === 'today'
        ? t('plans.dayToday')
        : t('plans.dayPlanned')

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        {
          backgroundColor:
            status === 'today' ? 'rgba(201,168,76,0.06)' : colors.bg2,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      {/* Icon */}
      <View style={[rowStyles.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={[rowStyles.iconText, { color: iconColor }]}>{iconChar}</Text>
      </View>

      {/* Body */}
      <View style={rowStyles.body}>
        <Text
          style={[
            rowStyles.title,
            { color: colors.label, fontWeight: status === 'today' ? '600' : '400' },
          ]}
          numberOfLines={1}
        >
          {dayLabel}
        </Text>
        <Text style={[rowStyles.sub, { color: status === 'today' ? colors.gold : colors.label3 }]}>
          {sub}
        </Text>
      </View>

      {/* Right */}
      <View style={rowStyles.right}>
        {status === 'today' ? (
          <View style={[rowStyles.startBtn, { backgroundColor: colors.gold }]}>
            <Text style={[rowStyles.startBtnText, { color: colors.onAccent }]}>{rightLabel}</Text>
          </View>
        ) : (
          <>
            <Text style={[rowStyles.rightText, { color: status === 'done' ? colors.green : colors.label3 }]}>
              {rightLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.label3} />
          </>
        )}
      </View>
    </Pressable>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderRadius: Radius.sm,
    marginBottom: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Type.body,
  },
  sub: {
    ...Type.caption1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rightText: {
    ...Type.caption1,
    fontWeight: '600',
  },
  startBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  startBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

// ─── Section Header ───────────────────────────────────────────────────

function SectionHdr({
  title,
  action,
  colors,
}: {
  title: string
  action: string
  colors: ReturnType<typeof useTheme>
}) {
  return (
    <View style={[sectionStyles.row, { borderBottomColor: colors.sep2 }]}>
      <Text style={[sectionStyles.title, { color: colors.label2 }]}>{title}</Text>
      <Text style={[sectionStyles.action, { color: colors.label3 }]}>{action}</Text>
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  title: {
    ...Type.caption1,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  action: {
    ...Type.caption1,
  },
})

// ─── Segmented Control (Training / Nutrition) ─────────────────────────

function PlanTypeSwitch({
  selected,
  onSelect,
  colors,
}: {
  selected: PlanTab
  onSelect: (tab: PlanTab) => void
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()
  const tabs: PlanTab[] = ['training', 'nutrition']

  return (
    <View style={[switchStyles.wrap, { backgroundColor: colors.fill }]}>
      {tabs.map((tab) => {
        const active = tab === selected
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            style={[switchStyles.segment, active && { backgroundColor: colors.bg2 }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                switchStyles.label,
                { color: active ? colors.label : colors.label2 },
              ]}
            >
              {tab === 'training' ? t('plans.training') : t('plans.nutrition')}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const switchStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: 2,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm - 2,
    alignItems: 'center',
  },
  label: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

// ─── Training Pane ────────────────────────────────────────────────────

function TrainingPane({
  trainingPlan,
  fullPlan,
  selectedWeek,
  onStep,
  onHeroPress,
  onRowPress,
  professionalName,
  colors,
}: {
  trainingPlan: ClientPlanSummary
  fullPlan: GetFullTrainingPlanResponse
  selectedWeek: number
  onStep: (dir: -1 | 1) => void
  onHeroPress: () => void
  onRowPress: (session: SessionDto, weekNum: number) => void
  professionalName?: string
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()
  const publishedWeekCount = fullPlan.publishedWeekCount ?? 0
  const currentPlanWeek = fullPlan.currentWeek

  const weekObj: WeekDto | null = useMemo(
    () => (fullPlan.weeks ?? []).find((w) => w.weekNumber === selectedWeek) ?? null,
    [fullPlan.weeks, selectedWeek],
  )

  // All sessions for the selected week, grouped by dayOfWeek then sorted by order
  const sessionsByDay = useMemo(() => {
    if (!weekObj) return []
    const sessions = (weekObj.sessions ?? []).slice().sort(
      (a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) || (a.order ?? 0) - (b.order ?? 0),
    )
    return sessions
  }, [weekObj])

  const isCurrentWeek = selectedWeek === (currentPlanWeek ?? -1)

  const sessionsDone = sessionsByDay.filter((s) =>
    sessionStatus(s, isCurrentWeek, currentPlanWeek, selectedWeek) === 'done',
  ).length

  const sectionTitle = isCurrentWeek
    ? t('plans.thisWeekLabel')
    : t('plans.weekLabel2', { week: selectedWeek })

  const sectionAction = t('plans.sessionsDoneHeader', {
    done: sessionsDone,
    total: sessionsByDay.length,
  })

  return (
    <>
      <PlanHero
        plan={trainingPlan}
        type="training"
        onPress={onHeroPress}
        professionalName={professionalName}
        colors={colors}
      />
      <WeekStepper
        week={selectedWeek}
        publishedWeekCount={publishedWeekCount}
        currentPlanWeek={currentPlanWeek}
        onStep={onStep}
        colors={colors}
      />
      <SectionHdr title={sectionTitle} action={sectionAction} colors={colors} />
      {sessionsByDay.length === 0 ? (
        <View style={paneStyles.emptyRow}>
          <Text style={[paneStyles.emptyText, { color: colors.label3 }]}>
            {t('plans.plansOnTheWay')}
          </Text>
        </View>
      ) : (
        sessionsByDay.map((session) => {
          const st = sessionStatus(session, isCurrentWeek, currentPlanWeek, selectedWeek)
          return (
            <TrainingSessionRow
              key={session.sessionId ?? String(session.dayOfWeek ?? 0) + String(session.order ?? 0)}
              session={session}
              status={st}
              onPress={() => onRowPress(session, selectedWeek)}
              colors={colors}
            />
          )
        })
      )}
    </>
  )
}

// ─── Nutrition Pane ───────────────────────────────────────────────────

function NutritionPane({
  nutritionPlan,
  fullPlan,
  selectedWeek,
  onStep,
  onHeroPress,
  onRowPress,
  professionalName,
  colors,
}: {
  nutritionPlan: ClientPlanSummary
  fullPlan: FullPlanResponse
  selectedWeek: number
  onStep: (dir: -1 | 1) => void
  onHeroPress: () => void
  onRowPress: (dayOfWeek: number, weekNum: number) => void
  professionalName?: string
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()
  const publishedWeekCount = fullPlan.publishedWeekCount ?? 0
  const currentPlanWeek = fullPlan.currentWeek
  const currentDayOfWeek = fullPlan.currentDayOfWeek

  const weekObj = useMemo(
    () => (fullPlan.weeks ?? []).find((w) => w.weekNumber === selectedWeek) ?? null,
    [fullPlan.weeks, selectedWeek],
  )

  const isCurrentWeek = selectedWeek === (currentPlanWeek ?? -1)

  // Build all 7 days; if the week has data for a day, include it; otherwise use placeholder.
  const allDays = useMemo(() => {
    const eatenSet = new Set<string>(fullPlan.eatenMealIds ?? [])
    return Array.from({ length: 7 }, (_, i) => {
      const dow = i + 1
      const day = (weekObj?.days ?? []).find((d) => d.dayOfWeek === dow) ?? null
      const meals = day?.meals ?? []
      const eatenCount = meals.filter((m) => m.mealId != null && eatenSet.has(m.mealId)).length
      return { dow, mealCount: meals.length, eatenCount, totalMeals: meals.length }
    })
  }, [weekObj, fullPlan.eatenMealIds])

  const daysDone = allDays.filter(
    (d) => dayStatus(d.dow, isCurrentWeek, currentPlanWeek, selectedWeek, currentDayOfWeek) === 'done',
  ).length

  const sectionTitle = isCurrentWeek
    ? t('plans.thisWeekLabel')
    : t('plans.weekLabel2', { week: selectedWeek })

  const sectionAction = t('plans.daysDoneHeader', {
    done: daysDone,
    total: 7,
  })

  return (
    <>
      <PlanHero
        plan={nutritionPlan}
        type="nutrition"
        onPress={onHeroPress}
        professionalName={professionalName}
        colors={colors}
      />
      <WeekStepper
        week={selectedWeek}
        publishedWeekCount={publishedWeekCount}
        currentPlanWeek={currentPlanWeek}
        onStep={onStep}
        colors={colors}
      />
      <SectionHdr title={sectionTitle} action={sectionAction} colors={colors} />
      {allDays.map((d) => {
        const st = dayStatus(d.dow, isCurrentWeek, currentPlanWeek, selectedWeek, currentDayOfWeek)
        return (
          <NutritionDayRow
            key={d.dow}
            dayOfWeek={d.dow}
            mealCount={d.mealCount}
            status={st}
            eaten={d.eatenCount}
            total={d.totalMeals}
            onPress={() => onRowPress(d.dow, selectedWeek)}
            colors={colors}
          />
        )
      })}
    </>
  )
}

const paneStyles = StyleSheet.create({
  emptyRow: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    ...Type.subheadline,
  },
})

// ─── Active Plans Content ─────────────────────────────────────────────

function ActivePlansContent({
  trainingPlan,
  nutritionPlan,
  trainerName,
  nutritionistName,
  colors,
}: {
  trainingPlan: ClientPlanSummary | null
  nutritionPlan: ClientPlanSummary | null
  trainerName?: string
  nutritionistName?: string
  colors: ReturnType<typeof useTheme>
}) {
  const { t } = useTranslation()
  const router = useRouter()

  const hasBothPlans = trainingPlan !== null && nutritionPlan !== null
  const [planTab, setPlanTab] = useState<PlanTab>('training')
  const [trainingWeek, setTrainingWeek] = useState<number | null>(null)
  const [nutritionWeek, setNutritionWeek] = useState<number | null>(null)

  // Full training plan query (enabled only when training plan exists)
  const trainingFullQuery = useQuery({
    queryKey: ['training-full-plan', trainingPlan?.planId ?? ''],
    queryFn: () => getFullTrainingPlan(trainingPlan!.planId!),
    enabled: trainingPlan !== null && Boolean(trainingPlan?.planId),
    staleTime: 60_000,
    retry: (failureCount, error: unknown) => {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  // Full nutrition plan query (enabled only when nutrition plan exists)
  const nutritionFullQuery = useQuery({
    queryKey: ['nutrition-full-plan'],
    queryFn: getFullPlan,
    enabled: nutritionPlan !== null,
    staleTime: 60_000,
    retry: (failureCount, error: unknown) => {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false
      return failureCount < 2
    },
  })

  const queryClient = useQueryClient()

  // Determine effective weeks (fall back to plan's currentWeek or 1)
  const trainingEffectiveWeek = useMemo(() => {
    if (trainingWeek !== null) return trainingWeek
    const pub = trainingFullQuery.data?.publishedWeekCount ?? 0
    const cur = trainingFullQuery.data?.currentWeek ?? 1
    return Math.min(Math.max(cur, 1), pub || 1)
  }, [trainingWeek, trainingFullQuery.data])

  const nutritionEffectiveWeek = useMemo(() => {
    if (nutritionWeek !== null) return nutritionWeek
    const pub = nutritionFullQuery.data?.publishedWeekCount ?? 0
    const cur = nutritionFullQuery.data?.currentWeek ?? 1
    return Math.min(Math.max(cur, 1), pub || 1)
  }, [nutritionWeek, nutritionFullQuery.data])

  const handleTrainingStep = useCallback(
    (dir: -1 | 1) => {
      const pubCount = trainingFullQuery.data?.publishedWeekCount ?? 0
      const next = trainingEffectiveWeek + dir
      if (next < 1 || next > pubCount) return
      setTrainingWeek(next)
    },
    [trainingEffectiveWeek, trainingFullQuery.data],
  )

  const handleNutritionStep = useCallback(
    (dir: -1 | 1) => {
      const pubCount = nutritionFullQuery.data?.publishedWeekCount ?? 0
      const next = nutritionEffectiveWeek + dir
      if (next < 1 || next > pubCount) return
      setNutritionWeek(next)
    },
    [nutritionEffectiveWeek, nutritionFullQuery.data],
  )

  const handleTrainingHeroPress = useCallback(() => {
    if (!trainingPlan?.planId) return
    router.push(hrefParams('/(client)/plans/[planId]', {
      planId: trainingPlan.planId,
      type: 'training',
    }))
  }, [router, trainingPlan])

  const handleNutritionHeroPress = useCallback(() => {
    if (!nutritionPlan?.planId) return
    router.push(hrefParams('/(client)/plans/[planId]', {
      planId: nutritionPlan.planId,
      type: 'nutrition',
    }))
  }, [router, nutritionPlan])

  const handleTrainingRowPress = useCallback(
    (session: SessionDto, weekNum: number) => {
      if (!trainingPlan?.planId) return
      router.push(hrefParams('/(client)/plans/[planId]', {
        planId: trainingPlan.planId,
        type: 'training',
        week: String(weekNum),
        day: String(session.dayOfWeek ?? 1),
      }))
    },
    [router, trainingPlan],
  )

  const handleNutritionRowPress = useCallback(
    (dayOfWeek: number, weekNum: number) => {
      if (!nutritionPlan?.planId) return
      router.push(hrefParams('/(client)/plans/[planId]', {
        planId: nutritionPlan.planId,
        type: 'nutrition',
        week: String(weekNum),
        day: String(dayOfWeek),
      }))
    },
    [router, nutritionPlan],
  )

  // Determine what to show based on plan availability
  const showSwitch = hasBothPlans
  const activeTab: PlanTab = hasBothPlans
    ? planTab
    : trainingPlan !== null
      ? 'training'
      : 'nutrition'

  // Loading state for the active pane
  const isTrainingLoading = activeTab === 'training' && trainingFullQuery.isLoading
  const isNutritionLoading = activeTab === 'nutrition' && nutritionFullQuery.isLoading
  const isLoading = isTrainingLoading || isNutritionLoading

  // Error states
  const trainingError = activeTab === 'training' && trainingFullQuery.isError
  const nutritionError = activeTab === 'nutrition' && nutritionFullQuery.isError

  const handleRetry = useCallback(() => {
    if (activeTab === 'training') {
      queryClient.invalidateQueries({ queryKey: ['training-full-plan', trainingPlan?.planId ?? ''] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['nutrition-full-plan'] })
    }
  }, [queryClient, activeTab, trainingPlan])

  if (isLoading) {
    return (
      <View style={contentStyles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  if (trainingError || nutritionError) {
    return (
      <View style={contentStyles.errorWrap}>
        <Text style={[contentStyles.errorText, { color: colors.label2 }]}>
          {t('plans.fetchError')}
        </Text>
        <Pressable
          onPress={handleRetry}
          style={[contentStyles.retryBtn, { borderColor: colors.gold }]}
        >
          <Text style={[contentStyles.retryText, { color: colors.gold }]}>
            {t('plans.retry')}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <>
      {showSwitch && (
        <PlanTypeSwitch
          selected={activeTab}
          onSelect={setPlanTab}
          colors={colors}
        />
      )}

      {/* Training pane — shown only when activeTab === 'training' */}
      {activeTab === 'training' && trainingPlan !== null && trainingFullQuery.data && (
        <TrainingPane
          trainingPlan={trainingPlan}
          fullPlan={trainingFullQuery.data}
          selectedWeek={trainingEffectiveWeek}
          onStep={handleTrainingStep}
          onHeroPress={handleTrainingHeroPress}
          onRowPress={handleTrainingRowPress}
          professionalName={trainerName}
          colors={colors}
        />
      )}

      {/* Nutrition pane — shown only when activeTab === 'nutrition' */}
      {activeTab === 'nutrition' && nutritionPlan !== null && nutritionFullQuery.data && (
        <NutritionPane
          nutritionPlan={nutritionPlan}
          fullPlan={nutritionFullQuery.data}
          selectedWeek={nutritionEffectiveWeek}
          onStep={handleNutritionStep}
          onHeroPress={handleNutritionHeroPress}
          onRowPress={handleNutritionRowPress}
          professionalName={nutritionistName}
          colors={colors}
        />
      )}
    </>
  )
}

const contentStyles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  errorWrap: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    ...Type.body,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  retryText: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

// ─── Completed Plan Row ───────────────────────────────────────────────

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
          <View style={[styles.statusTag, { backgroundColor: 'rgba(201,168,76,0.2)' }]}>
            <Text style={[styles.statusTagText, { color: colors.gold }]}>
              {`✓ ${t('plans.completed')}`}
            </Text>
          </View>
          <Text style={styles.planTypeLabel}>
            {isTraining ? t('plans.trainingPlanType') : t('plans.nutritionPlanType')}
          </Text>
          <Text style={styles.planName}>{plan.planName}</Text>
          {(plan.totalWeeks ?? 0) > 0 && (
            <Text style={styles.planSubtitle}>
              {t('plans.weeksCount', { count: plan.totalWeeks ?? 0 })}
            </Text>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: '100%', backgroundColor: colors.gold }]} />
          </View>
          <Text style={styles.planProgressLabel}>
            {t('plans.weekOf', { current: plan.totalWeeks ?? 0, total: plan.totalWeeks ?? 0 })} ✓
          </Text>
        </LinearGradient>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.publishedWeekCount ?? 0}
            </Text>
            <Text style={[styles.statDesc, { color: colors.label3 }]}>{t('plans.published')}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: colors.label }]}>
              {plan.totalWeeks ?? 0}
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

  // Active plans — lightweight summary query
  const activePlansQuery = useQuery({
    queryKey: ['client-plans-active'],
    queryFn: () => getClientPlans('Active' as PlanStatus),
    enabled: hasTrainer,
  })

  // Archive plans — lazy-loaded (only when navigating to archive)
  // We don't show archive inline anymore; the Archiv link navigates away.

  // Collaboration data for professional names
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

  const isLoading = activePlansQuery.isLoading
  const isRefreshing = activePlansQuery.isRefetching

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['client-plans-active'] })
    queryClient.invalidateQueries({ queryKey: ['collaborations'] })
  }, [queryClient])

  const activePlans = activePlansQuery.data?.items ?? []
  const trainingPlan = activePlans.find((p) => p.type === 'training') ?? null
  const nutritionPlan = activePlans.find((p) => p.type === 'nutrition') ?? null
  const hasAnyPlan = activePlans.length > 0

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[Type.largeTitle, { color: colors.label }]}>{t('plans.title')}</Text>
        <Pressable
          onPress={() => router.push(href('/(client)/plans/history'))}
          style={styles.archiveLink}
          accessibilityRole="link"
        >
          <Text style={[styles.archiveLinkText, { color: colors.blue }]}>
            {t('plans.archive')} ›
          </Text>
        </Pressable>
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

          {hasTrainer && hasAnyPlan && (
            <View style={styles.activePlansWrap}>
              <ActivePlansContent
                trainingPlan={trainingPlan}
                nutritionPlan={nutritionPlan}
                trainerName={trainerName}
                nutritionistName={nutritionistName}
                colors={colors}
              />
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
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  archiveLink: {
    paddingBottom: 3,
    minHeight: 44,
    justifyContent: 'flex-end',
  },
  archiveLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingBottom: 100,
  },
  activePlansWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  emptyCard: {
    margin: 16,
    borderRadius: Radius.md,
    padding: 32,
    alignItems: 'center',
  },
  // Retained from old UI for CompletedPlanCard
  planCard: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  planHero: {
    padding: 20,
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
})
