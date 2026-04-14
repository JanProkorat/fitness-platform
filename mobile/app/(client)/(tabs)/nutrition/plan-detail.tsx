import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
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
import { useRouter, useSegments } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { hrefParams } from '@/lib/navigation'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { MacroBar } from '@/components/ui/MacroBar'
import { useQueryClient } from '@tanstack/react-query'
import {
  getFullPlan,
  type FullPlanResponse,
  type FullPlanWeek,
  type PlanDay,
  type PlanMeal,
  type MealKind,
} from '@/api/nutrition'
import { onEvent } from '@/api/signalr'
import { QuestionnaireResponseSheet } from '@/components/questionnaire/QuestionnaireResponseSheet'
import {
  getDayLabels,
  formatWeekRange,
  getDayDate,
} from '@/lib/nutrition-plan-helpers'
import { MealCard } from '@/components/nutrition/MealCard'

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function NutritionPlanDetailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const segments = useSegments()
  const colors = useTheme()
  const scrollRef = useRef<ScrollView>(null)
  const queryClient = useQueryClient()

  // Detect which Stack we're in to keep navigation within the same Stack
  const basePath = (segments as string[]).includes('plans') ? '/(client)/plans' : '/(client)/nutrition'

  // Invalidate cache when coach updates or publishes the plan
  useEffect(() => {
    const offUpdated = onEvent('nutritionplanupdated', () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'full-plan'] })
    })
    const offPublished = onEvent('nutritionplanpublished', () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition', 'full-plan'] })
    })
    return () => { offUpdated(); offPublished() }
  }, [queryClient])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['nutrition', 'full-plan'],
    queryFn: getFullPlan,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: unknown) => {
      if ((error as { response?: { status?: number } })?.response?.status === 404) return false
      return failureCount < 3
    },
  })

  // ── State ──
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  // Map of "week-day" → Set of expanded meal IDs (persists across day/week switches)
  const [expandedMap, setExpandedMap] = useState<Record<string, Set<string>>>({})
  const [weekGridVisible, setWeekGridVisible] = useState(false)
  const [questionnaireSheetVisible, setQuestionnaireSheetVisible] = useState(false)

  // Derive effective week/day from data
  const effectiveWeek = selectedWeek ?? data?.currentWeek ?? 1
  const effectiveDay = selectedDay ?? data?.currentDayOfWeek ?? 1

  const currentWeekObj = useMemo(
    () => data?.weeks.find((w) => w.weekNumber === effectiveWeek) ?? null,
    [data, effectiveWeek],
  )

  const currentDayObj = useMemo(() => {
    if (!currentWeekObj) return null
    return (
      currentWeekObj.days.find((d) => d.dayOfWeek === effectiveDay) ?? null
    )
  }, [currentWeekObj, effectiveDay])

  const sortedMeals = useMemo(() => {
    if (!currentDayObj) return []
    return currentDayObj.meals.slice().sort((a, b) => a.order - b.order)
  }, [currentDayObj])

  // ── Eaten meals (from full plan response — covers all days, not just today) ──
  const eatenMealIds = useMemo(() => {
    return new Set<string>(data?.eatenMealIds ?? [])
  }, [data?.eatenMealIds])

  // Consumed totals: sum mealTotals for eaten meals in the current day
  const consumed = useMemo(() => {
    const zero = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    if (!currentDayObj) return zero
    return currentDayObj.meals
      .filter((m) => eatenMealIds.has(m.mealId))
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

  const settings = data?.globalSettings ?? null
  const publishedWeekCount = data?.publishedWeekCount ?? data?.weeks.length ?? 0
  const totalWeeks = data?.totalWeeks ?? 0

  // ── Callbacks ──

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

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
      // If selecting current week, go to current day, otherwise Monday
      setSelectedDay(
        week === data?.currentWeek ? (data?.currentDayOfWeek ?? 1) : 1,
      )
      setWeekGridVisible(false)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    },
    [data],
  )

  const handleSelectDay = useCallback(
    (day: number) => {
      setSelectedDay(day)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    },
    [],
  )

  const dayKey = `${effectiveWeek}-${effectiveDay}`
  const expandedMealIds = expandedMap[dayKey] ?? new Set<string>()

  const handleToggleMeal = useCallback((mealId: string) => {
    setExpandedMap((prev) => {
      const key = `${effectiveWeek}-${effectiveDay}`
      const current = new Set(prev[key] ?? [])
      if (current.has(mealId)) {
        current.delete(mealId)
      } else {
        current.add(mealId)
      }
      return { ...prev, [key]: current }
    })
  }, [effectiveWeek, effectiveDay])

  // Swipe left/right to switch days with slide animation
  const screenWidth = Dimensions.get('window').width
  const slideX = useSharedValue(0)
  const slideOpacity = useSharedValue(1)

  const swipeDay = useCallback(
    (dir: -1 | 1) => {
      const next = effectiveDay + dir
      if (next < 1 || next > 7) return

      // Slide out in swipe direction
      slideX.value = withTiming(-dir * screenWidth * 0.3, { duration: 150, easing: Easing.out(Easing.ease) }, () => {
        // Jump to opposite side (off-screen)
        slideX.value = dir * screenWidth * 0.3
        slideOpacity.value = 0
        // Switch day on JS thread
        runOnJS(setSelectedDay)(next)
        // Slide in from opposite side
        slideX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
        slideOpacity.value = withTiming(1, { duration: 200 })
      })
      scrollRef.current?.scrollTo({ y: 0, animated: false })
    },
    [effectiveDay, screenWidth, slideX, slideOpacity],
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

  const handleToggleWeekGrid = useCallback(() => {
    setWeekGridVisible((prev) => !prev)
  }, [])

  const handleShoppingPress = useCallback(() => {
    router.push(hrefParams(`${basePath}/shopping`, { week: String(effectiveWeek) }))
  }, [router, effectiveWeek, basePath])

  const handleQuestionnairePress = useCallback(() => {
    if (data?.questionnaireResponseId) {
      setQuestionnaireSheetVisible(true)
    }
  }, [data])

  // ── Loading ──
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  // ── Error ──
  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleBack} hitSlop={12}>
            <Text style={[styles.backText, { color: colors.gold }]}>
              ‹ {t('tabs.plans')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[Type.subheadline, { color: colors.label2 }]}>
            {t('nutrition.noPlanMessage')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const hasPrev = effectiveWeek > 1
  const hasNext = effectiveWeek < publishedWeekCount
  const isCurrentWeek = effectiveWeek === data.currentWeek
  const isToday = isCurrentWeek && effectiveDay === data.currentDayOfWeek
  const dayLabels = getDayLabels()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* ── Header: back + stepper + icons ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.gold }]}>
            ‹ {t('tabs.plans')}
          </Text>
        </TouchableOpacity>

        {/* Week stepper center */}
        <View style={styles.stepperCenter}>
          <TouchableOpacity
            onPress={() => handleStepWeek(-1)}
            disabled={!hasPrev}
            hitSlop={8}
          >
            <Text
              style={[
                styles.stepperArrow,
                { color: hasPrev ? colors.blue : colors.label3 },
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
            {currentWeekObj && (
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
                { color: hasNext ? colors.blue : colors.label3 },
              ]}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* Action icons */}
        <View style={styles.headerActions}>
          {data.questionnaireResponseId && (
            <TouchableOpacity
              onPress={handleQuestionnairePress}
              style={[styles.headerIconBtn, { backgroundColor: colors.fill }]}
            >
              <Ionicons
                name="clipboard-outline"
                size={16}
                color={colors.label2}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleShoppingPress}
            style={[styles.headerIconBtn, { backgroundColor: colors.fill }]}
          >
            <Ionicons name="cart-outline" size={16} color={colors.label2} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
      {/* ── Week grid overlay (absolute, on top of content) ── */}
      {weekGridVisible && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.weekGridOverlay]}
        >
          <Pressable style={styles.weekGridBackdrop} onPress={handleToggleWeekGrid} />
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[styles.weekGrid, { backgroundColor: colors.bg2, shadowColor: '#000' }]}
          >
            {data.weeks.map((w) => (
              <Pressable
                key={w.weekNumber}
                onPress={() => handleSelectWeek(w.weekNumber)}
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
      <View style={[styles.dayStrip, { backgroundColor: colors.bg }]}>
        {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
          const isSelected = dayNum === effectiveDay
          const isDayToday =
            isCurrentWeek && dayNum === data.currentDayOfWeek
          const dayHasContent = currentWeekObj?.days.some(
            (d) => d.dayOfWeek === dayNum && d.meals.length > 0,
          )
          const isPastCompleted =
            isCurrentWeek &&
            data.currentDayOfWeek != null &&
            dayNum < data.currentDayOfWeek &&
            dayHasContent

          const dateNum = currentWeekObj
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

      <GestureDetector gesture={swipeGesture}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={animatedSlideStyle}>
        {/* ── Day overview card ── */}
        {currentDayObj?.dayTotals && (
          <View style={[styles.macroCard, { backgroundColor: colors.bg2 }]}>
            <View style={styles.macroCardHeader}>
              <Text style={[Type.subheadline, { fontWeight: '600', color: colors.label }]}>
                {t('nutrition.dailyOverview')}
              </Text>
              <Text style={[styles.macroKcalText, { color: colors.label }]}>
                {Math.round(consumed.kcal)}{' '}
                <Text style={{ color: colors.label2, fontWeight: '400', fontSize: 13 }}>
                  / {Math.round(currentDayObj.dayTotals.kcal)} kcal
                </Text>
              </Text>
            </View>
            <MacroBar
              label={t('nutrition.protein')}
              current={Math.round(consumed.protein)}
              target={Math.round(currentDayObj.dayTotals.protein)}
              color={colors.macroProtein}
              horizontal
            />
            <MacroBar
              label={t('nutrition.carbs')}
              current={Math.round(consumed.carbs)}
              target={Math.round(currentDayObj.dayTotals.carbs)}
              color={colors.macroCarbs}
              horizontal
            />
            <MacroBar
              label={t('nutrition.fat')}
              current={Math.round(consumed.fat)}
              target={Math.round(currentDayObj.dayTotals.fat)}
              color={colors.macroFat}
              horizontal
            />
            <MacroBar
              label={t('nutrition.fiber')}
              current={Math.round(consumed.fiber)}
              target={Math.round(currentDayObj.dayTotals.fiber)}
              color={colors.macroFiber}
              horizontal
            />
          </View>
        )}

        {/* ── Daily note ── */}
        {currentDayObj?.note && (
          <View
            style={[styles.dailyNote, { backgroundColor: colors.bg2 }]}
          >
            <View style={{ backgroundColor: colors.goldBg, ...StyleSheet.absoluteFillObject, borderRadius: Radius.md }} />
            <Text style={[styles.dailyNoteText, { color: colors.label2 }]}>
              <Text style={{ fontWeight: '600', color: colors.gold }}>
                {t('nutrition.tip')}{' '}
              </Text>
              {currentDayObj.note}
            </Text>
          </View>
        )}

        {/* ── Meal cards ── */}
        {sortedMeals.length === 0 ? (
          <View style={styles.emptyMeals}>
            <Text style={[Type.subheadline, { color: colors.label3 }]}>
              {t('nutrition.noMeals')}
            </Text>
          </View>
        ) : (
          sortedMeals.map((meal) => (
            <MealCard
              key={meal.mealId}
              meal={meal}
              expanded={expandedMealIds.has(meal.mealId)}
              onToggle={() => handleToggleMeal(meal.mealId)}
              eaten={eatenMealIds.has(meal.mealId)}
            />
          ))
        )}
        </Animated.View>
      </ScrollView>
      </GestureDetector>
      </View>

      {/* Questionnaire response sheet */}
      {data.questionnaireResponseId && (
        <QuestionnaireResponseSheet
          visible={questionnaireSheetVisible}
          onClose={() => setQuestionnaireSheetVisible(false)}
          responseId={data.questionnaireResponseId}
        />
      )}
    </SafeAreaView>
    </GestureHandlerRootView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backBtn: {
    flexShrink: 0,
    paddingRight: 4,
  },
  backText: {
    ...Type.body,
  },
  stepperCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
  headerActions: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
  },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 34,
  },

  // Day strip
  dayStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
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

  // Macro card
  macroCard: {
    marginHorizontal: 20,
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
})
