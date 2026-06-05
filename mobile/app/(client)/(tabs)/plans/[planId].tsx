import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { MacroBar } from '@/components/ui/MacroBar'
import { MealCard } from '@/components/nutrition/MealCard'
import {
  getFullPlan,
  getTodayLog,
  type FullPlanResponse,
} from '@/api/nutrition'
import {
  getFullTrainingPlan,
  type GetFullTrainingPlanResponse,
  type SectionDto,
  type WorkoutFormat,
  type MuscleGroup,
  type LoggedSetDto,
} from '@/api/training'
import {
  getSubmittedQuestionnairesByCoach,
  type SubmittedAnswer,
} from '@/api/questionnaire'
import { onEvent } from '@/api/signalr'
import {
  getDayLabels,
  formatWeekRange,
  getDayDate,
} from '@/lib/nutrition-plan-helpers'
import { cancelReminder, listReminderKeys } from '@/lib/reminderScheduler'
import { SessionReminderRow } from '@/components/training/SessionReminderRow'
import {
  estimatedSectionDurationSeconds,
  formatDurationCompact,
  formatExerciseSummary,
} from '@/lib/training-plan-format'
import { hrefParams } from '@/lib/navigation'
import { DaySummaryHero, type BodyPartEntry } from '@/components/training/DaySummaryHero'
import { ExpandableSessionCard } from '@/components/training/ExpandableSessionCard'
import { ExpandableExerciseCard } from '@/components/training/ExpandableExerciseCard'
import { SectionHeader } from '@/components/training/SectionHeader'
import { AnimatedCollapse } from '@/components/training/AnimatedCollapse'
import { getMuscleGroupColor } from '@/constants/muscleGroups'
import { SetGrid } from '@/components/training/SetGrid'

// ─── Questionnaire Answers List ───────────────────────────────────────

function QuestionnaireAnswersList({ answers }: { answers: SubmittedAnswer[] }) {
  const colors = useTheme()
  return (
    <View style={[styles.answersWrap, { borderTopColor: colors.sep2 }]}>
      {answers.map((answer, idx) => (
        <View key={idx} style={styles.answerRow}>
          <Text style={[Type.caption1, { color: colors.label3, marginBottom: 2 }]}>
            {answer.label}
          </Text>
          <Text style={[Type.body, { color: colors.label }]}>
            {formatAnswer(answer)}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ─── Linked Questionnaire Section ─────────────────────────────────────

function LinkedQuestionnaireSection({
  questionnaireResponseId,
}: {
  questionnaireResponseId: string
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const { data: coachData } = useQuery({
    queryKey: ['submitted-questionnaires-by-coach'],
    queryFn: getSubmittedQuestionnairesByCoach,
    enabled: !!questionnaireResponseId,
  })

  const matchedResponse = useMemo(() => {
    if (!coachData?.coaches) return null
    for (const coach of coachData.coaches) {
      const found = (coach.responses ?? []).find(
        (r) => r.responsePublicId === questionnaireResponseId,
      )
      if (found) return { ...found, coachName: coach.professionalName }
    }
    return null
  }, [coachData, questionnaireResponseId])

  if (!matchedResponse) {
    return (
      <View style={[styles.linkedQSection, { backgroundColor: colors.bg2 }]}>
        <View style={styles.linkedQHeader}>
          <Text style={{ fontSize: 18 }}>📋</Text>
          <Text style={[Type.subheadline, { color: colors.label2, fontWeight: '500' }]}>
            {t('planDetail.linkedQuestionnaire')}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.linkedQSection, { backgroundColor: colors.bg2 }]}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.linkedQHeader}
      >
        <Text style={{ fontSize: 18 }}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={[Type.headline, { color: colors.label }]}>
            {matchedResponse.questionnaireTitle}
          </Text>
          {matchedResponse.submittedAt && (
            <Text style={[Type.caption1, { color: colors.label3, marginTop: 2 }]}>
              {t('profile.submittedAt', {
                date: new Date(matchedResponse.submittedAt).toLocaleDateString(),
              })}
            </Text>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.label3}
        />
      </Pressable>

      {expanded && (matchedResponse.answers ?? []).length > 0 && (
        <QuestionnaireAnswersList answers={matchedResponse.answers ?? []} />
      )}
    </View>
  )
}

function formatAnswer(answer: SubmittedAnswer): string {
  if (answer.valueText) return answer.valueText
  if (answer.valueNumber != null) return String(answer.valueNumber)
  if (answer.valueJson) {
    try {
      const parsed = JSON.parse(answer.valueJson)
      if (Array.isArray(parsed)) return parsed.join(', ')
      return answer.valueJson
    } catch {
      return answer.valueJson
    }
  }
  return '—'
}

// ─── Nutrition Plan Detail ────────────────────────────────────────────

function NutritionPlanDetail({
  plan,
  initialWeek,
  initialDay,
}: {
  plan: FullPlanResponse
  initialWeek?: number
  initialDay?: number
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollView>(null)
  const queryClient = useQueryClient()
  const router = useRouter()
  const planId = plan.planId ?? ''

  // ── State ──
  // initialWeek/initialDay seed the selected position when navigating from the
  // Plans tab week-stepper rows (AC7). Both are optional so existing call sites
  // (Today card, hero tap) that don't pass them fall through to the plan's own
  // currentWeek/currentDayOfWeek defaults.
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initialWeek ?? null)
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay ?? null)
  const [expandedMap, setExpandedMap] = useState<Record<string, Set<string>>>({})
  const [weekGridVisible, setWeekGridVisible] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  /**
   * Close the menu sheet and run `action` after the close animation completes.
   * Running `action` on the same frame as `setMenuOpen(false)` leaves the Modal
   * mounted mid-animation; its backdrop blocks the next sheet from opening or
   * the next Pressable from registering. 250 ms matches the sheet's close timing.
   */
  const selectMenuItem = useCallback((action: () => void) => {
    setMenuOpen(false)
    setTimeout(action, 250)
  }, [])

  const effectiveWeek = selectedWeek ?? plan.currentWeek ?? 1
  const effectiveDay = selectedDay ?? plan.currentDayOfWeek ?? 1

  // Invalidate cache when coach updates or publishes the plan
  useEffect(() => {
    const offUpdated = onEvent('nutritionplanupdated', () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-full-plan'] })
    })
    const offPublished = onEvent('nutritionplanpublished', () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-full-plan'] })
    })
    return () => { offUpdated(); offPublished() }
  }, [queryClient])

  // AC orphan-cleanup: after the plan loads, cancel any stored meal reminders
  // whose mealId is no longer present in the returned plan (e.g. coach deleted
  // a meal after the client had set a reminder for it).
  const allMealIds = useMemo(() => {
    const ids = new Set<string>()
    for (const week of plan.weeks ?? []) {
      for (const day of week.days ?? []) {
        for (const meal of day.meals ?? []) {
          if (meal.mealId) ids.add(meal.mealId)
        }
      }
    }
    return ids
  }, [plan])

  useEffect(() => {
    // Scope orphan-cleanup to THIS plan's namespace so reminders set against
    // other plans (active or archived) are not affected.
    const prefix = `meal-${planId}-`
    const storedKeys = listReminderKeys(prefix)
    storedKeys.forEach((key) => {
      const mealId = key.slice(prefix.length)
      if (!allMealIds.has(mealId)) {
        cancelReminder(key).catch(() => {
          // Ignore errors — the notification may already be gone.
        })
      }
    })
  }, [allMealIds, planId])

  // Questionnaire data for the bottom sheet (only fetched when a linked response exists)
  const { data: coachQData } = useQuery({
    queryKey: ['submitted-questionnaires-by-coach'],
    queryFn: getSubmittedQuestionnairesByCoach,
    enabled: !!plan.questionnaireResponseId,
  })

  const linkedResponse = useMemo(() => {
    if (!coachQData?.coaches || !plan.questionnaireResponseId) return null
    for (const coach of coachQData.coaches) {
      const found = (coach.responses ?? []).find(
        (r) => r.responsePublicId === plan.questionnaireResponseId,
      )
      if (found) return found
    }
    return null
  }, [coachQData, plan.questionnaireResponseId])

  const currentWeekObj = useMemo(
    () => (plan.weeks ?? []).find((w) => w.weekNumber === effectiveWeek) ?? null,
    [plan, effectiveWeek],
  )

  const currentDayObj = useMemo(() => {
    if (!currentWeekObj) return null
    return (currentWeekObj.days ?? []).find((d) => d.dayOfWeek === effectiveDay) ?? null
  }, [currentWeekObj, effectiveDay])

  const sortedMeals = useMemo(() => {
    if (!currentDayObj) return []
    return (currentDayObj.meals ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [currentDayObj])

  // Consumed totals: sum mealTotals for eaten meals in the current day
  const eatenMealIds = useMemo(
    () => new Set<string>(plan.eatenMealIds ?? []),
    [plan.eatenMealIds],
  )

  const consumed = useMemo(() => {
    const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    if (!currentDayObj) return zero
    return (currentDayObj.meals ?? [])
      .filter((m) => m.mealId != null && eatenMealIds.has(m.mealId))
      .reduce(
        (sum, m) => ({
          kcal: sum.kcal + (m.mealTotals?.kcal ?? 0),
          protein: sum.protein + (m.mealTotals?.protein ?? 0),
          carbs: sum.carbs + (m.mealTotals?.carbs ?? 0),
          fat: sum.fat + (m.mealTotals?.fat ?? 0),
          fiber: sum.fiber + (m.mealTotals?.fiber ?? 0),
        }),
        zero,
      )
  }, [currentDayObj, eatenMealIds])

  // Today's diary log — used to display meal photos on the current day's cards
  const { data: todayLog } = useQuery({
    queryKey: ['today-log'],
    queryFn: getTodayLog,
    staleTime: 60_000,
  })

  // Build a mealId → photos map. Photos only exist for today's meals; for other
  // days the map will simply have no matching entries and MealCard gets photos=[].
  const mealPhotosByMealId = useMemo(() => {
    const map: Record<string, { blobUrl: string; note?: string | null }[]> = {}
    for (const entry of todayLog?.mealsEaten ?? []) {
      if (!entry.mealId || !entry.photos?.length) continue
      map[entry.mealId] = entry.photos
        .filter((p) => !!p.blobUrl)
        .map((p) => ({ blobUrl: p.blobUrl as string, note: p.note ?? null }))
    }
    return map
  }, [todayLog])

  const publishedWeekCount = plan.publishedWeekCount ?? (plan.weeks ?? []).length ?? 0

  const hasPrev = effectiveWeek > 1
  const hasNext = effectiveWeek < publishedWeekCount
  const isCurrentWeek = effectiveWeek === plan.currentWeek

  const dayLabels = getDayLabels()

  // ── Callbacks ──

  const handleStepWeek = useCallback(
    (dir: -1 | 1) => {
      const next = effectiveWeek + dir
      if (next < 1 || next > publishedWeekCount) return
      setSelectedWeek(next)
      setSelectedDay(1)
      setWeekGridVisible(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    },
    [effectiveWeek, publishedWeekCount],
  )

  const handleSelectWeek = useCallback(
    (week: number) => {
      setSelectedWeek(week)
      setSelectedDay(
        week === plan.currentWeek ? (plan.currentDayOfWeek ?? 1) : 1,
      )
      setWeekGridVisible(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    },
    [plan],
  )

  const handleSelectDay = useCallback((day: number) => {
    setSelectedDay(day)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])

  const handleToggleWeekGrid = useCallback(() => {
    setWeekGridVisible((prev) => !prev)
  }, [])

  const dayKey = `${effectiveWeek}-${effectiveDay}`
  // Default: every meal on a freshly-viewed day is expanded. User toggles persist per-day
  // by seeding the stored Set with all meal IDs on the first interaction.
  const currentDayMealIds = useMemo(
    () => new Set(sortedMeals.map((m) => m.mealId)),
    [sortedMeals],
  )
  const expandedMealIds = expandedMap[dayKey] ?? currentDayMealIds

  const handleToggleMeal = useCallback((mealId: string) => {
    setExpandedMap((prev) => {
      const key = `${effectiveWeek}-${effectiveDay}`
      const current = new Set(prev[key] ?? currentDayMealIds)
      if (current.has(mealId)) {
        current.delete(mealId)
      } else {
        current.add(mealId)
      }
      return { ...prev, [key]: current }
    })
  }, [effectiveWeek, effectiveDay, currentDayMealIds])

  /** Navigate to the meal-log-photo modal — mirrors handlePhotoPress in HasTrainerState. */
  const handleMealPhotoPress = useCallback((meal: { mealId?: string | null; kind?: string | null; time?: string | null; mealTotals?: { kcal?: number | null } | null; foods?: unknown[] | null; recipes?: unknown[] | null }) => {
    const totalItems =
      (meal.foods?.length ?? 0) + (meal.recipes?.length ?? 0)
    router.push(
      hrefParams('/(client)/meal-log-photo', {
        mealId: meal.mealId ?? '',
        mealName: meal.kind ?? '',
        mealTime: meal.time ?? '',
        mealKcal: String(Math.round(meal.mealTotals?.kcal ?? 0)),
        mealItemsCount: String(totalItems),
      }),
    )
  }, [router])

  // Swipe left/right to switch days with slide animation
  const screenWidth = Dimensions.get('window').width
  const slideX = useSharedValue(0)
  const slideOpacity = useSharedValue(1)

  const swipeDay = useCallback(
    (dir: -1 | 1) => {
      const next = effectiveDay + dir
      // Wrap to the next week's Monday when swiping past Sunday on a week
      // that isn't the last published one — mirrors TrainingPlanDetail.
      if (next > 7) {
        if (effectiveWeek < publishedWeekCount) {
          slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
            slideX.value = dir * screenWidth * 0.3
            slideOpacity.value = 0
            runOnJS(setSelectedWeek)(effectiveWeek + 1)
            runOnJS(setSelectedDay)(1)
            slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
            slideOpacity.value = withTiming(1, { duration: 200 })
          })
          scrollRef.current?.scrollTo({ y: 0, animated: false })
        }
        return
      }
      // Wrap to the previous week's Sunday when swiping back past Monday
      // on a week that isn't the first one.
      if (next < 1) {
        if (effectiveWeek > 1) {
          slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
            slideX.value = dir * screenWidth * 0.3
            slideOpacity.value = 0
            runOnJS(setSelectedWeek)(effectiveWeek - 1)
            runOnJS(setSelectedDay)(7)
            slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
            slideOpacity.value = withTiming(1, { duration: 200 })
          })
          scrollRef.current?.scrollTo({ y: 0, animated: false })
        }
        return
      }

      slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
        slideX.value = dir * screenWidth * 0.3
        slideOpacity.value = 0
        runOnJS(setSelectedDay)(next)
        slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
        slideOpacity.value = withTiming(1, { duration: 200 })
      })
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    },
    [effectiveDay, effectiveWeek, publishedWeekCount, screenWidth, slideX, slideOpacity],
  )

  const animatedSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    opacity: slideOpacity.value,
  }))

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-30, 30])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          if (Math.abs(e.translationX) > 50) {
            runOnJS(swipeDay)(e.translationX > 0 ? -1 : 1)
          }
        }),
    [swipeDay],
  )

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header row: back button + week stepper on the same row ── */}
      <View style={styles.nutritionStepper}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.nutritionBackBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
          <Text style={[Type.body, { color: colors.gold }]}>{t('plans.title')}</Text>
        </Pressable>
        <TouchableOpacity
          onPress={() => handleStepWeek(-1)}
          disabled={!hasPrev}
          hitSlop={8}
        >
          <Text
            style={[
              styles.stepperArrow,
              { color: hasPrev ? colors.gold : colors.label3 },
            ]}
          >
            ‹
          </Text>
        </TouchableOpacity>
        <Pressable onPress={handleToggleWeekGrid} style={styles.stepperLabel}>
          <Text style={[styles.stepperWeekText, { color: colors.label }]}>
            {t('nutrition.weekLabel', {
              current: effectiveWeek,
              total: publishedWeekCount,
            })}
          </Text>
          {currentWeekObj?.weekStartDate && currentWeekObj?.weekEndDate && (
            <Text style={[styles.stepperDateText, { color: colors.label2 }]}>
              {formatWeekRange(
                currentWeekObj.weekStartDate,
                currentWeekObj.weekEndDate,
              )}
            </Text>
          )}
        </Pressable>
        <TouchableOpacity
          onPress={() => handleStepWeek(1)}
          disabled={!hasNext}
          hitSlop={8}
        >
          <Text
            style={[
              styles.stepperArrow,
              { color: hasNext ? colors.gold : colors.label3 },
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>

        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('planDetail.menuA11y')}
          style={[styles.nutritionMenuBtn, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.label} />
        </Pressable>
      </View>

      {/* ── Week grid overlay (absolute, on top of content) ── */}
      {weekGridVisible && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.weekGridOverlay}
        >
          <Pressable style={styles.weekGridBackdrop} onPress={handleToggleWeekGrid} />
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.weekGrid, { backgroundColor: colors.bg2, shadowColor: colors.shadow }]}
          >
            {(plan.weeks ?? []).map((w) => (
              <Pressable
                key={w.weekNumber}
                onPress={() => handleSelectWeek(w.weekNumber ?? 1)}
                style={[
                  styles.weekGridItem,
                  {
                    backgroundColor:
                      w.weekNumber === effectiveWeek ? colors.gold : colors.fill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.weekGridText,
                    {
                      color:
                        w.weekNumber === effectiveWeek ? '#fff' : colors.label,
                    },
                  ]}
                >
                  {w.weekNumber}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Day strip (fixed above scroll) ── */}
      <View style={[styles.dayStrip, { backgroundColor: colors.bg, borderBottomColor: colors.sep2 }]}>
        {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
          const isSelected = dayNum === effectiveDay
          const isDayToday =
            isCurrentWeek && dayNum === plan.currentDayOfWeek
          const dayHasContent = (currentWeekObj?.days ?? []).some(
            (d) => d.dayOfWeek === dayNum && (d.meals ?? []).length > 0,
          )
          const isPastCompleted =
            isCurrentWeek &&
            plan.currentDayOfWeek != null &&
            dayNum < plan.currentDayOfWeek &&
            dayHasContent

          const dateNum = currentWeekObj?.weekStartDate
            ? getDayDate(currentWeekObj.weekStartDate, dayNum)
            : dayNum

          return (
            <Pressable
              key={dayNum}
              onPress={() => handleSelectDay(dayNum)}
              style={styles.dayItem}
            >
              <Text
                style={[
                  styles.dayItemLabel,
                  {
                    color: dayHasContent ? colors.gold : colors.label3,
                  },
                ]}
              >
                {dayLabels[dayNum - 1]}
              </Text>
              <View
                style={[
                  styles.dayItemNum,
                  isSelected && { backgroundColor: colors.gold },
                  !isSelected &&
                    isPastCompleted && {
                      backgroundColor: colors.green + '22',
                    },
                ]}
              >
                {isPastCompleted && !isSelected ? (
                  <Ionicons name="checkmark" size={14} color={colors.green} />
                ) : (
                  <Text
                    style={[
                      styles.dayItemNumText,
                      {
                        color: isSelected
                          ? '#fff'
                          : isDayToday
                            ? colors.gold
                            : colors.label3,
                      },
                    ]}
                  >
                    {dateNum}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.dayItemDot,
                  {
                    backgroundColor: dayHasContent
                      ? isSelected || isDayToday
                        ? colors.gold
                        : colors.fill
                      : 'transparent',
                  },
                ]}
              />
            </Pressable>
          )
        })}
      </View>

      {/* ── Scrollable content (macro card + note + meals) ── */}
      <GestureDetector gesture={swipeGesture}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={animatedSlideStyle}>
            {/* Day overview card */}
            {currentDayObj?.dayTotals && (
              <View style={[styles.macroCard, { backgroundColor: colors.bg2 }]}>
                <View style={styles.macroCardHeader}>
                  <Text style={[Type.subheadline, { fontWeight: '600', color: colors.label }]}>
                    {t('nutrition.dailyOverview')}
                  </Text>
                  <Text style={[styles.macroKcalText, { color: colors.label }]}>
                    {Math.round(consumed.kcal)}{' '}
                    <Text style={{ color: colors.label2, fontWeight: '400', fontSize: 13 }}>
                      / {Math.round(currentDayObj.dayTotals.kcal ?? 0)} kcal
                    </Text>
                  </Text>
                </View>
                <MacroBar
                  label={t('nutrition.protein')}
                  current={Math.round(consumed.protein)}
                  target={Math.round(currentDayObj.dayTotals.protein ?? 0)}
                  color={colors.macroProtein}
                  horizontal
                />
                <MacroBar
                  label={t('nutrition.carbs')}
                  current={Math.round(consumed.carbs)}
                  target={Math.round(currentDayObj.dayTotals.carbs ?? 0)}
                  color={colors.macroCarbs}
                  horizontal
                />
                <MacroBar
                  label={t('nutrition.fat')}
                  current={Math.round(consumed.fat)}
                  target={Math.round(currentDayObj.dayTotals.fat ?? 0)}
                  color={colors.macroFat}
                  horizontal
                />
                <MacroBar
                  label={t('nutrition.fiber')}
                  current={Math.round(consumed.fiber)}
                  target={Math.round(currentDayObj.dayTotals.fiber ?? 0)}
                  color={colors.macroFiber}
                  horizontal
                />
              </View>
            )}

            {/* Daily note */}
            {currentDayObj?.note && (
              <View style={[styles.dailyNote, { backgroundColor: colors.goldBg }]}>
                <Text style={[styles.dailyNoteText, { color: colors.label2 }]}>
                  <Text style={{ fontWeight: '600', color: colors.gold }}>
                    {t('nutrition.dayNoteLabel')}{' '}
                  </Text>
                  {currentDayObj.note}
                </Text>
              </View>
            )}

            {/* Meal cards */}
            {sortedMeals.length === 0 ? (
              <View style={styles.emptyMeals}>
                <Text style={[Type.subheadline, { color: colors.label3 }]}>
                  {t('nutrition.noMeals')}
                </Text>
              </View>
            ) : (
              sortedMeals.map((meal) => (
                <MealCard
                  key={meal.mealId ?? ''}
                  meal={meal}
                  expanded={expandedMealIds.has(meal.mealId ?? '')}
                  onToggle={() => handleToggleMeal(meal.mealId ?? '')}
                  eaten={eatenMealIds.has(meal.mealId ?? '')}
                  photos={mealPhotosByMealId[meal.mealId ?? ''] ?? []}
                  onPhotoPress={() => handleMealPhotoPress(meal)}
                  dayLabel={dayLabels[effectiveDay - 1] ?? ''}
                  planId={planId}
                />
              ))
            )}
          </Animated.View>
        </ScrollView>
      </GestureDetector>

      {/* ── Questionnaire bottom sheet ── */}
      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={linkedResponse?.questionnaireTitle ?? t('planDetail.linkedQuestionnaire')}
        heightFraction={0.7}
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {linkedResponse ? (
            (linkedResponse.answers ?? []).length > 0 ? (
              <QuestionnaireAnswersList answers={linkedResponse.answers ?? []} />
            ) : (
              <View style={styles.sheetEmptyState}>
                <Text style={[Type.subheadline, { color: colors.label3 }]}>
                  {t('planDetail.answersNotAvailable')}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.sheetEmptyState}>
              {coachQData ? (
                <Text style={[Type.subheadline, { color: colors.label3 }]}>
                  {t('planDetail.answersNotAvailable')}
                </Text>
              ) : (
                <ActivityIndicator color={colors.gold} />
              )}
            </View>
          )}
        </ScrollView>
      </BottomSheet>

      {/* ── Actions menu bottom sheet ── */}
      <BottomSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={t('common.options')}
        heightFraction={0.35}
      >
        <View style={styles.menuList}>
          <Pressable
            style={styles.menuRow}
            onPress={() => selectMenuItem(() =>
              router.push(hrefParams('/(client)/plans/shopping', { week: String(effectiveWeek) }))
            )}
          >
            <Ionicons name="cart-outline" size={22} color={colors.label} />
            <Text style={[Type.body, { color: colors.label }]}>{t('nutrition.shoppingList')}</Text>
          </Pressable>
          <View style={[styles.menuSeparator, { backgroundColor: colors.sep2 }]} />
          {plan.questionnaireResponseId && (
            <>
              <Pressable
                style={styles.menuRow}
                onPress={() => selectMenuItem(() => setSheetOpen(true))}
              >
                <Ionicons name="clipboard-outline" size={22} color={colors.label} />
                <Text style={[Type.body, { color: colors.label }]}>{t('planDetail.linkedQuestionnaire')}</Text>
              </Pressable>
              <View style={[styles.menuSeparator, { backgroundColor: colors.sep2 }]} />
            </>
          )}
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              selectMenuItem(() =>
                router.push(hrefParams('/(client)/plan-photos', { planId: plan.planId ?? '', planType: 'nutrition' })),
              )
            }
          >
            <Ionicons name="images-outline" size={22} color={colors.label} />
            <Text style={[Type.body, { color: colors.label }]}>{t('planPhotos.title')}</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  )
}

// ─── Training Plan Detail ─────────────────────────────────────────────

/** Returns today's day of week as 1=Monday…7=Sunday */
function todayDayOfWeek(): number {
  const d = new Date().getDay() // 0=Sun..6=Sat
  return d === 0 ? 7 : d
}

function TrainingPlanDetail({
  plan,
  initialWeek,
  initialDay,
}: {
  plan: GetFullTrainingPlanResponse
  initialWeek?: number
  initialDay?: number
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  const scrollRef = useRef<ScrollView>(null)
  const queryClient = useQueryClient()
  const router = useRouter()
  const planId = plan.planId ?? ''

  // ── State ──
  const publishedWeekCount = plan.publishedWeekCount ?? 0

  const firstPublishedWeek = useMemo(
    () => (plan.weeks ?? []).find((w) => w.status === 'Published')?.weekNumber ?? 1,
    [plan.weeks],
  )

  // initialWeek/initialDay seed the selected position when navigating from the
  // Plans tab week-stepper rows (AC7). Optional — existing call sites don't pass them.
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initialWeek ?? null)
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay ?? null)
  const [weekGridVisible, setWeekGridVisible] = useState(false)
  const [trainingSheetOpen, setTrainingSheetOpen] = useState(false)
  // expandedSessionsMap: "${week}-${day}" → Set of sessionIds (undefined = all expanded)
  const [expandedSessionsMap, setExpandedSessionsMap] = useState<
    Record<string, Set<string>>
  >({})
  // Per-session per-section expand state: sessionId → { sectionId → boolean }
  // All sections default collapsed (false); toggled via SectionHeader chevron.
  const [sectionExpandedMap, setSectionExpandedMap] = useState<
    Record<string, Record<string, boolean>>
  >({})

  const effectiveWeek = selectedWeek ?? plan.currentWeek ?? firstPublishedWeek
  // Default to today only when viewing the current week; otherwise open on Monday
  // (e.g. plan hasn't started yet → first week is in the future → show Monday)
  const effectiveDay =
    selectedDay ?? (effectiveWeek === plan.currentWeek ? todayDayOfWeek() : 1)

  const hasPrev = effectiveWeek > 1
  const hasNext = effectiveWeek < publishedWeekCount
  const isCurrentWeek = effectiveWeek === plan.currentWeek

  const dayLabels = getDayLabels()

  // ── Questionnaire data ──
  const { data: coachQData } = useQuery({
    queryKey: ['submitted-questionnaires-by-coach'],
    queryFn: getSubmittedQuestionnairesByCoach,
    enabled: !!plan.questionnaireResponseId,
  })

  const linkedResponse = useMemo(() => {
    if (!coachQData?.coaches || !plan.questionnaireResponseId) return null
    for (const coach of coachQData.coaches) {
      const found = (coach.responses ?? []).find(
        (r) => r.responsePublicId === plan.questionnaireResponseId,
      )
      if (found) return found
    }
    return null
  }, [coachQData, plan.questionnaireResponseId])

  // ── Derived ──
  const currentWeekObj = useMemo(
    () => (plan.weeks ?? []).find((w) => w.weekNumber === effectiveWeek) ?? null,
    [plan.weeks, effectiveWeek],
  )

  const currentDaySessions = useMemo(() => {
    if (!currentWeekObj) return []
    return (currentWeekObj.sessions ?? [])
      .filter((s) => s.dayOfWeek === effectiveDay)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }, [currentWeekObj, effectiveDay])

  const dayBodyParts = useMemo((): BodyPartEntry[] => {
    const map = new Map<MuscleGroup, { done: number; total: number }>()
    for (const session of currentDaySessions) {
      // Prefer section-grouped exercises; fall back to flat list for legacy data.
      const allExercises = (session.sections ?? []).length > 0
        ? (session.sections ?? []).flatMap((sec) => sec.exercises ?? [])
        : (session.exercises ?? [])
      for (const ex of allExercises) {
        for (const mg of (ex.muscleGroups ?? [])) {
          const prev = map.get(mg) ?? { done: 0, total: 0 }
          map.set(mg, {
            done: prev.done + (ex.isCompleted ? 1 : 0),
            total: prev.total + 1,
          })
        }
      }
    }
    return Array.from(map.entries())
      .map(([mg, counts]) => ({ mg, ...counts }))
      .sort((a, b) => b.total - a.total)
  }, [currentDaySessions])

  const dayTotalExercises = useMemo(
    () => currentDaySessions.reduce((s, sess) => s + (sess.totalExerciseCount ?? 0), 0),
    [currentDaySessions],
  )
  const dayCompletedExercises = useMemo(
    () => currentDaySessions.reduce((s, sess) => s + (sess.completedExerciseCount ?? 0), 0),
    [currentDaySessions],
  )
  const dayCompletedSessions = useMemo(
    () =>
      currentDaySessions.filter(
        (sess) =>
          (sess.totalExerciseCount ?? 0) > 0 &&
          (sess.completedExerciseCount ?? 0) === (sess.totalExerciseCount ?? 0),
      ).length,
    [currentDaySessions],
  )

  // AC orphan-cleanup: after the plan loads, cancel any stored session reminders
  // whose sessionId is no longer present in the returned plan (e.g. coach deleted
  // a session after the client had set a reminder for it).
  const allSessionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const week of plan.weeks ?? []) {
      for (const sess of week.sessions ?? []) {
        if (sess.sessionId) ids.add(sess.sessionId)
      }
    }
    return ids
  }, [plan])

  useEffect(() => {
    // Scope orphan-cleanup to THIS plan's namespace so reminders set against
    // other plans (active or archived) are not affected.
    const prefix = `session-${planId}-`
    const storedKeys = listReminderKeys(prefix)
    storedKeys.forEach((key) => {
      const sessionId = key.slice(prefix.length)
      if (!allSessionIds.has(sessionId)) {
        cancelReminder(key).catch(() => {
          // Ignore errors — the notification may already be gone.
        })
      }
    })
  }, [allSessionIds, planId])

  // ── Callbacks ──
  const handleStepWeek = useCallback(
    (dir: -1 | 1) => {
      const next = effectiveWeek + dir
      if (next < 1 || next > publishedWeekCount) return
      setSelectedWeek(next)
      setSelectedDay(1)
      setWeekGridVisible(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    },
    [effectiveWeek, publishedWeekCount],
  )

  const handleSelectWeek = useCallback(
    (week: number) => {
      setSelectedWeek(week)
      // Training plans don't have currentDayOfWeek — default to today when on current week
      setSelectedDay(week === plan.currentWeek ? todayDayOfWeek() : 1)
      setWeekGridVisible(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    },
    [plan],
  )

  const handleSelectDay = useCallback((day: number) => {
    setSelectedDay(day)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])

  const handleToggleWeekGrid = useCallback(() => {
    setWeekGridVisible((prev) => !prev)
  }, [])

  // ── Swipe gesture (mirrors NutritionPlanDetail exactly) ──
  const screenWidth = Dimensions.get('window').width
  const slideX = useSharedValue(0)
  const slideOpacity = useSharedValue(1)

  const swipeDay = useCallback(
    (dir: -1 | 1) => {
      const next = effectiveDay + dir
      // Week boundary wrap
      if (next > 7) {
        if (effectiveWeek < publishedWeekCount) {
          slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
            slideX.value = dir * screenWidth * 0.3
            slideOpacity.value = 0
            runOnJS(setSelectedWeek)(effectiveWeek + 1)
            runOnJS(setSelectedDay)(1)
            slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
            slideOpacity.value = withTiming(1, { duration: 200 })
          })
          scrollRef.current?.scrollTo({ y: 0, animated: false })
        }
        return
      }
      if (next < 1) {
        if (effectiveWeek > 1) {
          slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
            slideX.value = dir * screenWidth * 0.3
            slideOpacity.value = 0
            runOnJS(setSelectedWeek)(effectiveWeek - 1)
            runOnJS(setSelectedDay)(7)
            slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
            slideOpacity.value = withTiming(1, { duration: 200 })
          })
          scrollRef.current?.scrollTo({ y: 0, animated: false })
        }
        return
      }

      slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
        slideX.value = dir * screenWidth * 0.3
        slideOpacity.value = 0
        runOnJS(setSelectedDay)(next)
        slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
        slideOpacity.value = withTiming(1, { duration: 200 })
      })
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    },
    [effectiveDay, effectiveWeek, publishedWeekCount, screenWidth, slideX, slideOpacity],
  )

  const animatedSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    opacity: slideOpacity.value,
  }))

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-30, 30])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          if (Math.abs(e.translationX) > 50) {
            runOnJS(swipeDay)(e.translationX > 0 ? -1 : 1)
          }
        }),
    [swipeDay],
  )

  return (
    <View style={{ flex: 1 }}>
      {/* ── Header row: back button + week stepper + questionnaire chip ── */}
      <View style={styles.nutritionStepper}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.nutritionBackBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
          <Text style={[Type.body, { color: colors.gold }]}>{t('plans.title')}</Text>
        </Pressable>
        <TouchableOpacity
          onPress={() => handleStepWeek(-1)}
          disabled={!hasPrev}
          hitSlop={8}
        >
          <Text
            style={[
              styles.stepperArrow,
              { color: hasPrev ? colors.gold : colors.label3 },
            ]}
          >
            ‹
          </Text>
        </TouchableOpacity>
        <Pressable onPress={handleToggleWeekGrid} style={styles.stepperLabel}>
          <Text style={[styles.stepperWeekText, { color: colors.label }]}>
            {t('training.weekLabel', {
              current: effectiveWeek,
              total: publishedWeekCount,
            })}
          </Text>
          {currentWeekObj && (
            <Text style={[styles.stepperDateText, { color: colors.label2 }]}>
              {formatWeekRange(
                currentWeekObj.weekStartDate ?? '',
                currentWeekObj.weekEndDate ?? '',
              )}
            </Text>
          )}
        </Pressable>
        <TouchableOpacity
          onPress={() => handleStepWeek(1)}
          disabled={!hasNext}
          hitSlop={8}
        >
          <Text
            style={[
              styles.stepperArrow,
              { color: hasNext ? colors.gold : colors.label3 },
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>

        {plan.questionnaireResponseId && (
          <Pressable
            onPress={() => setTrainingSheetOpen(true)}
            hitSlop={12}
            style={[styles.nutritionMenuBtn, { backgroundColor: colors.fill }]}
          >
            <Ionicons name="clipboard-outline" size={20} color={colors.label} />
          </Pressable>
        )}

        {planId ? (
          <Pressable
            onPress={() => router.push(hrefParams('/(client)/plan-photos', { planId, planType: 'training' }))}
            hitSlop={12}
            style={[styles.nutritionMenuBtn, { backgroundColor: colors.fill }]}
            accessibilityRole="button"
            accessibilityLabel={t('planPhotos.openA11y')}
          >
            <Ionicons name="images-outline" size={20} color={colors.label} />
          </Pressable>
        ) : null}
      </View>

      {/* ── Week grid overlay ── */}
      {weekGridVisible && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.weekGridOverlay}
        >
          <Pressable style={styles.weekGridBackdrop} onPress={handleToggleWeekGrid} />
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.weekGrid, { backgroundColor: colors.bg2, shadowColor: colors.shadow }]}
          >
            {(plan.weeks ?? []).map((w) => (
              <Pressable
                key={w.weekNumber}
                onPress={() => handleSelectWeek(w.weekNumber ?? 1)}
                style={[
                  styles.weekGridItem,
                  {
                    backgroundColor:
                      w.weekNumber === effectiveWeek ? colors.gold : colors.fill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.weekGridText,
                    {
                      color: w.weekNumber === effectiveWeek ? '#fff' : colors.label,
                    },
                  ]}
                >
                  {w.weekNumber}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Day strip ── */}
      <View style={[styles.dayStrip, { backgroundColor: colors.bg, borderBottomColor: colors.sep2 }]}>
        {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
          const isSelected = dayNum === effectiveDay
          // Training plan has no server-side currentDayOfWeek; use device's today
          const isDayToday = isCurrentWeek && dayNum === todayDayOfWeek()
          const daySessions = (currentWeekObj?.sessions ?? []).filter((s) => s.dayOfWeek === dayNum)
          const hasContent = daySessions.length > 0
          const allDone =
            hasContent &&
            daySessions.every((s) => (s.completedExerciseCount ?? 0) === (s.totalExerciseCount ?? 0) && (s.totalExerciseCount ?? 0) > 0)

          const dateNum = currentWeekObj?.weekStartDate
            ? getDayDate(currentWeekObj.weekStartDate, dayNum)
            : dayNum

          return (
            <Pressable
              key={dayNum}
              onPress={() => handleSelectDay(dayNum)}
              style={styles.dayItem}
            >
              <Text
                style={[
                  styles.dayItemLabel,
                  { color: hasContent ? colors.gold : colors.label3 },
                ]}
              >
                {dayLabels[dayNum - 1]}
              </Text>
              <View
                style={[
                  styles.dayItemNum,
                  isSelected && { backgroundColor: colors.gold },
                  !isSelected && allDone && { backgroundColor: colors.green + '22' },
                ]}
              >
                {!isSelected && allDone ? (
                  <Ionicons name="checkmark" size={14} color={colors.green} />
                ) : (
                  <Text
                    style={[
                      styles.dayItemNumText,
                      {
                        color: isSelected
                          ? '#fff'
                          : isDayToday
                            ? colors.gold
                            : colors.label3,
                      },
                    ]}
                  >
                    {dateNum}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.dayItemDot,
                  {
                    backgroundColor: hasContent
                      ? isSelected || isDayToday
                        ? colors.gold
                        : colors.fill
                      : 'transparent',
                  },
                ]}
              />
            </Pressable>
          )
        })}
      </View>

      {/* ── Scrollable content ── */}
      <GestureDetector gesture={swipeGesture}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={animatedSlideStyle}>
            {/* Day summary hero */}
            <DaySummaryHero
              sessionsCount={currentDaySessions.length}
              exercisesCount={dayTotalExercises}
              bodyParts={dayBodyParts}
              completedSessions={dayCompletedSessions}
              completedExercises={dayCompletedExercises}
            />

            {/* Day note */}
            {(currentWeekObj?.dayNotes ?? {})[effectiveDay] && (
              <View style={[styles.dailyNote, { backgroundColor: colors.goldBg }]}>
                <Text style={[styles.dailyNoteText, { color: colors.label2 }]}>
                  <Text style={{ fontWeight: '600', color: colors.gold }}>
                    {t('nutrition.dayNoteLabel')}{' '}
                  </Text>
                  {(currentWeekObj?.dayNotes ?? {})[effectiveDay]}
                </Text>
              </View>
            )}

            {/* Session cards */}
            {currentDaySessions.length === 0 ? (
              <View style={styles.emptyMeals}>
                <Text style={[Type.subheadline, { color: colors.label3 }]}>
                  {t('training.restDay')}
                </Text>
                <Text style={[Type.caption1, { color: colors.label3, marginTop: 4 }]}>
                  {t('training.restDayHint')}
                </Text>
              </View>
            ) : (
              <View style={styles.sessionsWrap}>
                {currentDaySessions.map((session, index) => {
                  const sessionKey = `${effectiveWeek}-${effectiveDay}`
                  const allSessionIds = new Set(
                    currentDaySessions.map((s) => s.sessionId ?? ''),
                  )
                  const expandedSessions =
                    expandedSessionsMap[sessionKey] ?? allSessionIds
                  const isSessionExpanded = expandedSessions.has(session.sessionId ?? '')

                  // Resolve ordered sections. Fall back to a synthetic single section
                  // from flat exercises for any legacy data that slips through.
                  const sections: SectionDto[] =
                    (session.sections ?? []).length > 0
                      ? [...(session.sections ?? [])].sort(
                          (a, b) => (a.order ?? 0) - (b.order ?? 0),
                        )
                      : (session.exercises ?? []).length > 0
                        ? [{
                            sectionId: session.sessionId ?? '',
                            order: 0,
                            name: t('training.section.defaultName'),
                            format: undefined,
                            exercises: [...(session.exercises ?? [])].sort(
                              (a, b) => (a.order ?? 0) - (b.order ?? 0),
                            ),
                          }]
                        : []

                  // Session summary: workout count + total timed duration + untimed count.
                  // Mirrors TrainingCard.tsx lines ~340-358 (Today screen pattern).
                  const sectionDurations = sections.map((sec) =>
                    estimatedSectionDurationSeconds(sec.format as WorkoutFormat | undefined, sec.formatConfig),
                  )
                  const timedSeconds = sectionDurations.reduce<number>(
                    (sum, d) => sum + (d ?? 0),
                    0,
                  )
                  const untimedCount = sectionDurations.filter(
                    (d) => d == null || d === 0,
                  ).length
                  const summaryParts: string[] = [
                    t('training.workoutCount', { count: sections.length }),
                  ]
                  if (timedSeconds > 0) summaryParts.push(formatDurationCompact(timedSeconds))
                  if (timedSeconds > 0 && untimedCount > 0) {
                    summaryParts.push(t('training.workoutUntimedCount', { count: untimedCount }))
                  }

                  // Read-only session completion indicator for headerRight.
                  // A session is complete IFF every section (workout) within it
                  // is complete. Empty-exercise sections are flagged complete by
                  // the backend via TrainingCompletion.CompletedSectionIds
                  // (#260 fix).
                  const isSessionComplete =
                    sections.length > 0 &&
                    sections.every((sec) => sec.isCompleted === true)

                  const sessionCheckIndicator = (
                    <View
                      style={[
                        styles.sessionCheckIndicator,
                        isSessionComplete
                          ? { backgroundColor: colors.green, borderColor: colors.green }
                          : { backgroundColor: 'transparent', borderColor: colors.sep },
                      ]}
                    >
                      {isSessionComplete && (
                        <Ionicons name="checkmark" size={14} color={colors.onAccent} />
                      )}
                    </View>
                  )

                  // Per-section expand state for this session
                  const sessionSectionExpanded =
                    sectionExpandedMap[session.sessionId ?? ''] ?? {}

                  return (
                    <ExpandableSessionCard
                      key={session.sessionId ?? index}
                      name={session.name ?? ''}
                      summaryText={summaryParts.join(' · ')}
                      defaultExpanded={isSessionExpanded}
                      standalone
                      headerRight={sessionCheckIndicator}
                      bodyFooter={<SessionReminderRow session={session} planId={planId} />}
                    >
                      {/* Section-grouped exercise cards (read-only) */}
                      {sections.map((section, sectionIdx) => {
                        const sectionKey = section.sectionId ?? `section-${sectionIdx}`
                        const sectionExercises = (section.exercises ?? [])
                          .slice()
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                        const hasExercises = sectionExercises.length > 0
                        const isWodFormat =
                          section.format != null && section.format !== 'Standard'
                        // Plan-detail context: workouts open by default so the
                        // user sees the prescription at a glance. Today is the
                        // opposite (starts collapsed).
                        const isExpanded =
                          hasExercises && (sessionSectionExpanded[sectionKey] ?? true)
                        // Read-only completion indicator for the section header.
                        // Uses section.isCompleted from the backend (#260 fix)
                        // so empty-exercise sections show the correct indicator.
                        // undefined = no indicator (section never attempted).
                        const isSectionComplete: boolean | undefined =
                          section.isCompleted === true
                            ? true
                            : sectionExercises.some((e) => e.isCompleted === true)
                              ? false
                              : undefined

                        const isLastSection = sectionIdx === sections.length - 1

                        return (
                          <View
                            key={sectionKey}
                            style={[
                              styles.sectionWrap,
                              isLastSection ? { borderBottomWidth: 0 } : { borderBottomColor: colors.sep2 },
                            ]}
                          >
                            <SectionHeader
                              name={section.name ?? t('training.section.defaultName')}
                              format={section.format as WorkoutFormat | undefined}
                              formatConfig={section.formatConfig}
                              notes={section.notes}
                              durationSeconds={undefined}
                              exerciseCount={sectionExercises.length}
                              isExpanded={isExpanded}
                              onToggleExpanded={() => {
                                const sid = session.sessionId ?? ''
                                setSectionExpandedMap((prev) => ({
                                  ...prev,
                                  [sid]: {
                                    ...(prev[sid] ?? {}),
                                    [sectionKey]: !(prev[sid]?.[sectionKey] ?? false),
                                  },
                                }))
                              }}
                              nonExpandable={!hasExercises}
                              suppressBottomDivider={!isExpanded}
                              isSectionComplete={isSectionComplete}
                            />

                            {/* Exercises animate in/out when section is toggled */}
                            <AnimatedCollapse expanded={isExpanded}>
                              {sectionExercises.map((exercise, exIdx) => {
                                const exId = exercise.exerciseExternalId ?? null

                                const sets = exercise.sets ?? []
                                // Single source of truth — same helper used
                                // by the Today card and the trainer portal.
                                // Handles Reps / Time / Distance /
                                // RepsForTime + "BW" fallback for unset
                                // weight + duration formatting (`900 s` →
                                // `15 min`).
                                // `GetFullTrainingPlan` serialises
                                // `movementType` as the enum's string
                                // name (NSwag emits it as a plain
                                // `string`, not the typed enum). The
                                // values match `MovementType` exactly,
                                // so a `as` cast is sound.
                                const exSummary = formatExerciseSummary(
                                  sets,
                                  exercise.movementType as
                                    | import('@/api/training').MovementType
                                    | null
                                    | undefined,
                                  isWodFormat,
                                )

                                // Dot color: first muscle group, fall back to gold
                                const primaryMg = (exercise.muscleGroups ?? [])[0]
                                const dotColor =
                                  primaryMg != null
                                    ? getMuscleGroupColor(primaryMg, colors)
                                    : colors.gold

                                // Build LoggedSetDto array from FullPlanSet (#441).
                                // FullPlanSet carries actual + planned + isModified after
                                // backend #440. Sets without actual data (never performed)
                                // have all actual* === null and isModified === false.
                                const planLoggedSets: LoggedSetDto[] | undefined =
                                  sets.some((s) => s.isModified != null)
                                    ? sets.map((s, si) => ({
                                        setNumber: s.setNumber ?? si + 1,
                                        actualReps: s.actualReps ?? undefined,
                                        actualWeightKg: s.actualWeightKg ?? undefined,
                                        actualRpe: s.actualRpe ?? undefined,
                                        actualDurationSeconds: s.actualDurationSeconds ?? undefined,
                                        actualDistanceMeters: s.actualDistanceMeters ?? undefined,
                                        plannedReps: s.plannedReps ?? undefined,
                                        plannedWeightKg: s.plannedWeightKg ?? undefined,
                                        plannedRpe: s.plannedRpe ?? undefined,
                                        plannedDurationSeconds: s.plannedDurationSeconds ?? undefined,
                                        plannedDistanceMeters: s.plannedDistanceMeters ?? undefined,
                                        isModified: s.isModified ?? false,
                                      }))
                                    : undefined

                                return (
                                  <ExpandableExerciseCard
                                    key={exId ?? exIdx}
                                    name={exercise.exerciseName ?? ''}
                                    summaryText={exSummary}
                                    dotColor={dotColor}
                                    isCompleted={exercise.isCompleted ?? false}
                                    defaultExpanded={true}
                                    nested
                                    nestedFirst={exIdx === 0}
                                    nonExpandable={isWodFormat}
                                    hideCompletionIndicator={isWodFormat}
                                    notes={exercise.notes}
                                    hasModifications={exercise.hasModifications ?? false}
                                  >
                                    <SetGrid
                                      sets={sets}
                                      completedSetNumbers={sets
                                        .filter((s) => s.completedAt != null)
                                        .map((s) => s.setNumber ?? 0)
                                        .filter((n) => n > 0)}
                                      loggedSets={planLoggedSets}
                                    />
                                  </ExpandableExerciseCard>
                                )
                              })}
                            </AnimatedCollapse>
                          </View>
                        )
                      })}
                    </ExpandableSessionCard>
                  )
                })}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </GestureDetector>

      {/* ── Questionnaire bottom sheet ── */}
      <BottomSheet
        visible={trainingSheetOpen}
        onClose={() => setTrainingSheetOpen(false)}
        title={linkedResponse?.questionnaireTitle ?? t('planDetail.linkedQuestionnaire')}
        heightFraction={0.7}
      >
        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {linkedResponse ? (
            (linkedResponse.answers ?? []).length > 0 ? (
              <QuestionnaireAnswersList answers={linkedResponse.answers ?? []} />
            ) : (
              <View style={styles.sheetEmptyState}>
                <Text style={[Type.subheadline, { color: colors.label3 }]}>
                  {t('planDetail.answersNotAvailable')}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.sheetEmptyState}>
              {coachQData ? (
                <Text style={[Type.subheadline, { color: colors.label3 }]}>
                  {t('planDetail.answersNotAvailable')}
                </Text>
              ) : (
                <ActivityIndicator color={colors.gold} />
              )}
            </View>
          )}
        </ScrollView>
      </BottomSheet>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function PlanDetailScreen() {
  // week and day are optional search params added by AC7 — the Plans tab rows
  // deep-link here with pre-selected week+day. Existing call sites (Today card,
  // hero tap) don't pass them and continue to work with plan defaults.
  const { planId, type, week, day } = useLocalSearchParams<{
    planId: string
    type?: string
    week?: string
    day?: string
  }>()
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()

  const isNutrition = type === 'nutrition'

  // Parse optional week/day route params into numbers (undefined when absent)
  const initialWeek = week ? parseInt(week, 10) || undefined : undefined
  const initialDay = day ? parseInt(day, 10) || undefined : undefined

  const nutritionQuery = useQuery({
    queryKey: ['nutrition-full-plan'],
    queryFn: getFullPlan,
    enabled: isNutrition,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: unknown) => {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false
      return failureCount < 3
    },
  })

  const trainingQuery = useQuery({
    queryKey: ['training-full-plan', planId],
    queryFn: () => getFullTrainingPlan(planId),
    enabled: !isNutrition && !!planId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: unknown) => {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false
      return failureCount < 3
    },
  })

  const isLoading = isNutrition ? nutritionQuery.isLoading : trainingQuery.isLoading

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        ) : isNutrition && nutritionQuery.data ? (
          <NutritionPlanDetail
            plan={nutritionQuery.data}
            initialWeek={initialWeek}
            initialDay={initialDay}
          />
        ) : !isNutrition && trainingQuery.data ? (
          <TrainingPlanDetail
            plan={trainingQuery.data}
            initialWeek={initialWeek}
            initialDay={initialDay}
          />
        ) : (
          <View style={styles.centered}>
            <Text style={[Type.headline, { color: colors.label3 }]}>{t('plans.planNotFound')}</Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Nutrition stepper
  nutritionStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  nutritionBackBtn: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  nutritionMenuBtn: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperArrow: {
    fontSize: 20,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  stepperLabel: {
    alignItems: 'center',
  },
  stepperWeekText: {
    ...Type.callout,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  stepperDateText: {
    ...Type.caption2,
    marginTop: 1,
  },

  // Week grid overlay
  weekGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  weekGridBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  weekGrid: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 11,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  weekGridItem: {
    width: '22%',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  weekGridText: {
    ...Type.subheadline,
    fontWeight: '600',
  },

  // Day strip
  dayStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  dayItemLabel: {
    ...Type.caption2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dayItemNum: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayItemNumText: {
    ...Type.callout,
    fontWeight: '600',
  },
  dayItemDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 34,
  },

  // Macro card
  macroCard: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: Radius.lg,
    padding: 14,
  },
  macroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  macroKcalText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // Daily note
  dailyNote: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  dailyNoteText: {
    ...Type.footnote,
    flex: 1,
    lineHeight: 20,
  },

  // Empty
  emptyMeals: {
    paddingTop: 40,
    alignItems: 'center',
  },
  // Training plan detail — no horizontal padding; standalone ExpandableSessionCard
  // carries its own marginHorizontal: 16 in standalone mode.
  sessionsWrap: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  // Section divider wrap — mirrors TrainingCard's sectionWrap
  sectionWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Read-only session checkbox — static View matching TrainingCard's sessionCheck style.
  sessionCheckIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // Linked questionnaire
  linkedQSection: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  linkedQHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  answersWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  answerRow: {
    gap: 1,
  },

  // Section spacing
  section: {
    marginTop: 16,
  },

  // Actions menu sheet
  menuList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  menuSeparator: {
    height: StyleSheet.hairlineWidth,
  },

  // Questionnaire sheet
  sheetScroll: {
    flex: 1,
  },
  sheetScrollContent: {
    paddingBottom: 16,
  },
  sheetEmptyState: {
    paddingTop: 32,
    alignItems: 'center',
  },
})
