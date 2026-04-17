import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import PagerView from 'react-native-pager-view';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { hrefParams } from '@/lib/navigation';
import i18n from '@/i18n';
import {
  getFullPlan,
  type FullPlanResponse,
  type FullPlanWeek,
  type PlanDay,
  type PlanMeal,
  type NutrientTotals,
} from '@/api/nutrition';

/** Map JS Date.getDay() (0=Sun) to our format (1=Mon … 7=Sun). */
function getCurrentDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

interface DayInfo {
  weekIndex: number;
  weekNumber: number;
  dayOfWeek: number;
  week: FullPlanWeek;
  day: PlanDay;
}

/** Flatten all weeks × days into a single ordered list of pages. */
function buildDayList(data: FullPlanResponse): DayInfo[] {
  const list: DayInfo[] = [];
  // Generated types make weeks/days arrays optional; guard with ?? [].
  (data.weeks ?? []).forEach((week, weekIndex) => {
    (week.days ?? [])
      .slice()
      .sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0))
      .forEach((day) => {
        list.push({
          weekIndex,
          weekNumber: week.weekNumber ?? weekIndex + 1,
          dayOfWeek: day.dayOfWeek ?? 0,
          week,
          day,
        });
      });
  });
  return list;
}

/** Compute the initial PagerView page index. */
function computeInitialPage(
  allDays: DayInfo[],
  data: FullPlanResponse,
  paramWeekNumber?: number,
  paramDayOfWeek?: number,
): number {
  // If returning from week overview with explicit params, use those.
  if (paramWeekNumber != null && paramDayOfWeek != null) {
    const idx = allDays.findIndex(
      (d) => d.weekNumber === paramWeekNumber && d.dayOfWeek === paramDayOfWeek,
    );
    if (idx >= 0) return idx;
  }
  // Active plan: go to today.
  if (data.currentWeek != null && data.currentDayOfWeek != null) {
    const idx = allDays.findIndex(
      (d) =>
        d.weekNumber === data.currentWeek &&
        d.dayOfWeek === data.currentDayOfWeek,
    );
    if (idx >= 0) return idx;
  }
  // Upcoming plan or fallback: page 0.
  return 0;
}

function formatWeekRange(startDate: string, endDate: string): string {
  const locale = i18n.language;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDayLabel(weekStartDate: string, dayOfWeek: number): string {
  const locale = i18n.language;
  const start = new Date(weekStartDate);
  const date = new Date(start);
  date.setDate(start.getDate() + (dayOfWeek - 1));
  const str = date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useTheme();
  const params = useLocalSearchParams<{ weekNumber?: string; dayOfWeek?: string }>();

  const paramWeekNumber = params.weekNumber ? parseInt(params.weekNumber, 10) : undefined;
  const paramDayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek, 10) : undefined;

  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['full-plan'],
    queryFn: getFullPlan,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 1000, // short cache for errors so tab switches retry quickly
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });

  const handleManualRefresh = useCallback(async () => {
    setIsManualRefresh(true);
    await refetch();
    setIsManualRefresh(false);
  }, [refetch]);

  const allDays = useMemo(() => (data ? buildDayList(data) : []), [data]);

  const initialPage = useMemo(
    () =>
      data && allDays.length > 0
        ? computeInitialPage(allDays, data, paramWeekNumber, paramDayOfWeek)
        : 0,
    [data, allDays, paramWeekNumber, paramDayOfWeek],
  );

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(initialPage);
  const pagerRef = useRef<PagerView>(null);

  useEffect(() => {
    if (paramWeekNumber != null && paramDayOfWeek != null && allDays.length > 0) {
      const idx = allDays.findIndex(
        (d) => d.weekNumber === paramWeekNumber && d.dayOfWeek === paramDayOfWeek,
      );
      if (idx >= 0) {
        pagerRef.current?.setPage(idx);
        setCurrentPageIndex(idx);
      }
    }
  }, [paramWeekNumber, paramDayOfWeek, allDays]);

  const currentDayInfo = allDays[currentPageIndex];
  const currentWeekNumber = currentDayInfo?.weekNumber ?? 1;
  const totalWeeks = data?.totalWeeks ?? (data?.weeks ?? []).length;
  const currentWeekObj = currentDayInfo?.week ?? null;

  const isUpcoming = data != null && data.currentWeek == null;

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      setCurrentPageIndex(e.nativeEvent.position);
    },
    [],
  );

  const handlePrevWeek = useCallback(() => {
    if (!allDays.length) return;
    // Find first page of the previous week
    const prevWeekNumber = currentWeekNumber - 1;
    if (prevWeekNumber < 1) return;
    const idx = allDays.findIndex((d) => d.weekNumber === prevWeekNumber);
    if (idx >= 0) {
      pagerRef.current?.setPage(idx);
    }
  }, [allDays, currentWeekNumber]);

  const handleNextWeek = useCallback(() => {
    if (!allDays.length) return;
    const nextWeekNumber = currentWeekNumber + 1;
    if (nextWeekNumber > totalWeeks) return;
    const idx = allDays.findIndex((d) => d.weekNumber === nextWeekNumber);
    if (idx >= 0) {
      pagerRef.current?.setPage(idx);
    }
  }, [allDays, currentWeekNumber, totalWeeks]);

  const handleWeekCenterPress = useCallback(() => {
    router.push(hrefParams('/nutrition/week-overview', { weekNumber: String(currentWeekNumber) }));
  }, [router, currentWeekNumber]);

  const handleShoppingPress = useCallback(() => {
    router.push(hrefParams('/nutrition/shopping', {}));
  }, [router]);

  const publishedWeekNumbers = useMemo(
    () => (data?.weeks ?? []).map((w) => w.weekNumber),
    [data],
  );

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <Header title={t('nutrition.title')} onShoppingPress={handleShoppingPress} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  // ── No-plan state (404 or any error) ──────────────────────────────────────

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <Header title={t('nutrition.title')} onShoppingPress={handleShoppingPress} />
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl refreshing={isManualRefresh} onRefresh={handleManualRefresh} tintColor={colors.gold} />
          }
        >
          <View style={[styles.emptyCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
            <Text style={[styles.emptyCardText, { color: colors.label2 }]}>
              {t('nutrition.noPlanMessage')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  const hasPrevWeek = publishedWeekNumbers.some((w) => w != null && w < currentWeekNumber);
  const hasNextWeek = publishedWeekNumbers.some((w) => w != null && w > currentWeekNumber);

  const startDate = (data?.weeks ?? [])[0]?.weekStartDate;
  const planStartFormatted = startDate
    ? new Date(startDate).toLocaleDateString(i18n.language, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <Header title={t('nutrition.title')} onShoppingPress={handleShoppingPress} />

      {/* Upcoming banner */}
      {isUpcoming && (
        <View style={[styles.upcomingBanner, { backgroundColor: colors.gold + '22', borderColor: colors.gold }]}>
          <Text style={[styles.upcomingBannerText, { color: colors.gold }]}>
            {t('nutrition.planStartsBanner', { date: planStartFormatted })}
          </Text>
        </View>
      )}

      {/* Week bar */}
      <View style={styles.weekBar}>
        <TouchableOpacity
          style={[styles.weekArrow, !hasPrevWeek && styles.weekArrowDisabled]}
          onPress={handlePrevWeek}
          disabled={!hasPrevWeek}
        >
          <Text style={[styles.weekArrowText, !hasPrevWeek && styles.weekArrowTextDisabled, { color: !hasPrevWeek ? colors.label3 : colors.label }]}>
            ‹
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.weekCenter} onPress={handleWeekCenterPress}>
          <Text style={[styles.weekLabel, { color: colors.label }]}>
            {t('nutrition.weekLabel', { current: currentWeekNumber, total: totalWeeks })}
          </Text>
          {currentWeekObj?.weekStartDate && currentWeekObj?.weekEndDate && (
            <Text style={[styles.weekRange, { color: colors.label3 }]}>
              {formatWeekRange(currentWeekObj.weekStartDate, currentWeekObj.weekEndDate)}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.weekArrow, !hasNextWeek && styles.weekArrowDisabled]}
          onPress={handleNextWeek}
          disabled={!hasNextWeek}
        >
          <Text style={[styles.weekArrowText, !hasNextWeek && styles.weekArrowTextDisabled, { color: !hasNextWeek ? colors.label3 : colors.label }]}>
            ›
          </Text>
        </TouchableOpacity>
      </View>

      {/* Day dots indicator */}
      {allDays.length > 0 && (
        <View style={styles.swipeHintDots}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <View
              key={d}
              style={[
                styles.swipeHintDot,
                { backgroundColor: colors.label3 },
                d === (currentDayInfo?.dayOfWeek ?? 0) && { backgroundColor: colors.gold, opacity: 1 },
              ]}
            />
          ))}
        </View>
      )}

      {/* Day pager */}
      {allDays.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('nutrition.noPlanMessage')}</Text>
        </View>
      ) : (
        <PagerView
          ref={pagerRef}
          style={styles.pager}
          initialPage={initialPage}
          onPageSelected={handlePageSelected}
        >
          {allDays.map((dayInfo, index) => (
            <View key={index} style={styles.pageWrapper}>
              <DayPage
                dayInfo={dayInfo}
                data={data}
                isActive={index === currentPageIndex}
                isRefreshing={isManualRefresh}
                onRefresh={handleManualRefresh}
                t={t}
              />
            </View>
          ))}
        </PagerView>
      )}
    </SafeAreaView>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
  onShoppingPress: () => void;
}

function Header({ title, onShoppingPress }: HeaderProps) {
  const colors = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.headerTitle, { color: colors.label }]}>{title}</Text>
      <TouchableOpacity style={[styles.shoppingBtn, { backgroundColor: colors.bg2, borderColor: colors.sep }]} onPress={onShoppingPress}>
        <Text style={styles.shoppingBtnIcon}>🛒</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Day Page ────────────────────────────────────────────────────────────────

interface DayPageProps {
  dayInfo: DayInfo;
  data: FullPlanResponse;
  isActive: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function DayPage({ dayInfo, data, isActive, isRefreshing, onRefresh, t }: DayPageProps) {
  const colors = useTheme();
  const { week, day } = dayInfo;

  const opacity = useSharedValue(isActive ? 1 : 0);
  const translateY = useSharedValue(isActive ? 0 : 10);

  useEffect(() => {
    if (isActive) {
      opacity.value = 0;
      translateY.value = 10;
      opacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
      translateY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) });
    }
  }, [isActive, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isToday =
    data.currentWeek != null &&
    data.currentDayOfWeek != null &&
    dayInfo.weekNumber === data.currentWeek &&
    dayInfo.dayOfWeek === data.currentDayOfWeek;

  const dayLabel = formatDayLabel(week.weekStartDate ?? '', day.dayOfWeek ?? 0);
  const totals = day.dayTotals;

  const sortedMeals = useMemo(
    () => (day.meals ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [day.meals],
  );

  return (
    <ScrollView
      style={styles.pageScroll}
      contentContainerStyle={styles.pageScrollContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
        />
      }
    >
      <Animated.View style={animatedStyle}>
      {/* Day name + date */}
      <View style={styles.dayHeader}>
        <Text style={[styles.dayLabel, isToday && { color: colors.gold }, !isToday && { color: colors.label }]}>{dayLabel}</Text>
        {isToday && (
          <View style={[styles.todayBadge, { backgroundColor: colors.gold }]}>
            <Text style={[styles.todayBadgeText, { color: colors.bg }]}>{t('nutrition.today')}</Text>
          </View>
        )}
      </View>

      {/* Macro summary bar */}
      {totals && <MacroBar totals={totals} t={t} />}

      {/* Meal cards */}
      {sortedMeals.length === 0 ? (
        <View style={styles.noMealsContainer}>
          <Text style={[styles.noMealsText, { color: colors.label3 }]}>{t('nutrition.meals', { count: 0 })}</Text>
        </View>
      ) : (
        sortedMeals.map((meal) => (
          <MealCard
            key={meal.mealId}
            meal={meal}
          />
        ))
      )}
      </Animated.View>
    </ScrollView>
  );
}

// ─── Macro Bar ───────────────────────────────────────────────────────────────

interface MacroBarProps {
  totals: NutrientTotals;
  t: (key: string) => string;
}

function MacroBar({ totals, t }: MacroBarProps) {
  const colors = useTheme();
  return (
    <View style={[styles.macroBar, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
      <MacroItem
        label={t('nutrition.kcal')}
        value={Math.round(totals.kcal ?? 0)}
        unit=""
        color={colors.orange}
      />
      <View style={[styles.macroDivider, { backgroundColor: colors.sep }]} />
      <MacroItem
        label={t('nutrition.protein')}
        value={Math.round(totals.protein ?? 0)}
        unit="g"
        color={colors.macroProtein}
      />
      <View style={[styles.macroDivider, { backgroundColor: colors.sep }]} />
      <MacroItem
        label={t('nutrition.carbs')}
        value={Math.round(totals.carbs ?? 0)}
        unit="g"
        color={colors.macroCarbs}
      />
      <View style={[styles.macroDivider, { backgroundColor: colors.sep }]} />
      <MacroItem
        label={t('nutrition.fat')}
        value={Math.round(totals.fat ?? 0)}
        unit="g"
        color={colors.macroFat}
      />
    </View>
  );
}

interface MacroItemProps {
  label: string;
  value: number;
  unit: string;
  color: string;
}

function MacroItem({ label, value, unit, color }: MacroItemProps) {
  const colors = useTheme();
  return (
    <View style={styles.macroItem}>
      <Text style={[styles.macroValue, { color }]}>
        {value}
        {unit}
      </Text>
      <Text style={[styles.macroLabel, { color: colors.label3 }]}>{label}</Text>
    </View>
  );
}

// ─── Meal Card ───────────────────────────────────────────────────────────────

interface MealCardProps {
  meal: PlanMeal;
}

function MealCard({ meal }: MealCardProps) {
  const { t } = useTranslation();
  const colors = useTheme();
  const [expanded, setExpanded] = useState(false);
  const kcal = meal.mealTotals?.kcal ?? 0;
  // Generated PlanMeal uses `kind` (MealKind enum), not `name`.
  const mealTitle = meal.kind ? t(`nutrition.mealKind.${meal.kind}`) : '';
  const foods = meal.foods ?? [];

  return (
    <TouchableOpacity
      style={[styles.mealCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.75}
    >
      <View style={styles.mealCardContent}>
        <View style={styles.mealCardHeader}>
          <View style={styles.mealCardLeft}>
            <Text style={[styles.mealName, { color: colors.label }]}>{mealTitle}</Text>
            <Text style={[styles.mealMeta, { color: colors.label3 }]}>
              {meal.time ? `${meal.time} · ` : ''}
              {t('nutrition.foodCount', { count: foods.length })}
              {kcal > 0 ? ` · ${Math.round(kcal)} kcal` : ''}
            </Text>
          </View>
          <Text style={[styles.mealChevron, { color: colors.label3 }, expanded && styles.mealChevronExpanded]}>
            ›
          </Text>
        </View>

        {expanded && foods.length > 0 && (
          <View style={[styles.foodsList, { borderTopColor: colors.sep }]}>
            {foods.map((food, idx) => {
              const scale = (food.amountGrams ?? 0) / 100;
              const n = food.nutrientValuePer100Grams;
              return (
                <View key={`${food.foodExternalId ?? idx}`} style={styles.foodRow}>
                  <View style={styles.foodInfo}>
                    <Text style={[styles.foodName, { color: colors.label2 }]}>{food.foodName}</Text>
                    <Text style={[styles.foodAmount, { color: colors.label3 }]}>{Math.round(food.amountGrams ?? 0)}g</Text>
                  </View>
                  <View style={styles.foodMacros}>
                    <Text style={[styles.foodMacro, { color: colors.label3 }]}>{Math.round((n?.kcal ?? 0) * scale)}</Text>
                    <Text style={[styles.foodMacro, { color: colors.macroProtein }]}>{Math.round((n?.protein ?? 0) * scale)}g</Text>
                    <Text style={[styles.foodMacro, { color: colors.macroCarbs }]}>{Math.round((n?.carbs ?? 0) * scale)}g</Text>
                    <Text style={[styles.foodMacro, { color: colors.macroFat }]}>{Math.round((n?.fat ?? 0) * scale)}g</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  shoppingBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoppingBtnIcon: {
    fontSize: 18,
  },

  // Upcoming banner
  upcomingBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  upcomingBannerText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Week bar
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  weekArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekArrowDisabled: {
    opacity: 0.3,
  },
  weekArrowText: {
    fontSize: 24,
    lineHeight: 28,
  },
  weekArrowTextDisabled: {},
  weekCenter: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  weekRange: {
    fontSize: 12,
    marginTop: 2,
  },

  // Pager
  pager: {
    flex: 1,
  },
  pageWrapper: {
    flex: 1,
  },
  pageScroll: {
    flex: 1,
  },
  pageScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Day header inside page
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
    gap: 8,
  },
  dayLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  dayLabelToday: {},
  todayBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Day dots
  swipeHintDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  swipeHintDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    opacity: 0.2,
  },
  swipeHintDotActive: {
    opacity: 1,
  },

  // Macro bar
  macroBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    marginBottom: 14,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  macroDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },

  // Meal card
  mealCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  mealCardContent: {
    flex: 1,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealCardLeft: {
    flex: 1,
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
  },
  mealMeta: {
    fontSize: 12,
    marginTop: 3,
  },
  mealChevron: {
    fontSize: 20,
    marginLeft: 8,
  },
  mealChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  foodsList: {
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 13,
    fontWeight: '500',
  },
  foodAmount: {
    fontSize: 11,
    marginTop: 1,
  },
  foodMacros: {
    flexDirection: 'row',
    gap: 10,
  },
  foodMacro: {
    fontSize: 11,
    minWidth: 28,
    textAlign: 'right',
  },

  // Empty states
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  emptyCardText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  noMealsContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  noMealsText: {
    fontSize: 14,
  },
});
