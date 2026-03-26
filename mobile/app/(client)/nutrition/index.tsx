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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import PagerView from 'react-native-pager-view';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../constants/Colors';
import {
  getFullPlan,
  type FullPlanResponse,
  type FullPlanWeek,
  type PlanDay,
  type PlanMeal,
  type NutrientTotals,
} from '../../../src/api/nutrition';

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
  data.weeks.forEach((week, weekIndex) => {
    week.days
      .slice()
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .forEach((day) => {
        list.push({
          weekIndex,
          weekNumber: week.weekNumber,
          dayOfWeek: day.dayOfWeek,
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
  const start = new Date(startDate);
  const end = new Date(endDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDayLabel(weekStartDate: string, dayOfWeek: number): string {
  // dayOfWeek: 1=Mon … 7=Sun
  const start = new Date(weekStartDate);
  // weekStartDate is Monday; offset by (dayOfWeek - 1) days
  const date = new Date(start);
  date.setDate(start.getDate() + (dayOfWeek - 1));
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ weekNumber?: string; dayOfWeek?: string }>();

  const paramWeekNumber = params.weekNumber ? parseInt(params.weekNumber, 10) : undefined;
  const paramDayOfWeek = params.dayOfWeek ? parseInt(params.dayOfWeek, 10) : undefined;

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
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
  const totalWeeks = data?.totalWeeks ?? data?.weeks.length ?? 0;
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
    router.push({
      pathname: '/nutrition/week-overview' as any,
      params: { weekNumber: currentWeekNumber },
    });
  }, [router, currentWeekNumber]);

  const handleShoppingPress = useCallback(() => {
    router.push('/nutrition/shopping' as any);
  }, [router]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title={t('nutrition.title')} onShoppingPress={handleShoppingPress} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
        </View>
      </SafeAreaView>
    );
  }

  // ── No-plan state (404 or any error) ──────────────────────────────────────

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title={t('nutrition.title')} onShoppingPress={handleShoppingPress} />
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.dark.gold} />
          }
        >
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardText}>
              {t('nutrition.noPlanMessage')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  const hasPrevWeek = currentWeekNumber > 1;
  const hasNextWeek = currentWeekNumber < totalWeeks;

  const startDate = data?.weeks[0]?.weekStartDate;
  const planStartFormatted = startDate
    ? new Date(startDate).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <Header title={t('nutrition.title')} onShoppingPress={handleShoppingPress} />

      {/* Upcoming banner */}
      {isUpcoming && (
        <View style={styles.upcomingBanner}>
          <Text style={styles.upcomingBannerText}>
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
          <Text style={[styles.weekArrowText, !hasPrevWeek && styles.weekArrowTextDisabled]}>
            ‹
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.weekCenter} onPress={handleWeekCenterPress}>
          <Text style={styles.weekLabel}>
            {t('nutrition.weekLabel', { current: currentWeekNumber, total: totalWeeks })}
          </Text>
          {currentWeekObj && (
            <Text style={styles.weekRange}>
              {formatWeekRange(currentWeekObj.weekStartDate, currentWeekObj.weekEndDate)}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.weekArrow, !hasNextWeek && styles.weekArrowDisabled]}
          onPress={handleNextWeek}
          disabled={!hasNextWeek}
        >
          <Text style={[styles.weekArrowText, !hasNextWeek && styles.weekArrowTextDisabled]}>
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
                d === (currentDayInfo?.dayOfWeek ?? 0) && styles.swipeHintDotActive,
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
                isRefreshing={isRefetching}
                onRefresh={refetch}
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
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      <TouchableOpacity style={styles.shoppingBtn} onPress={onShoppingPress}>
        <Text style={styles.shoppingBtnIcon}>🛒</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Day Page ────────────────────────────────────────────────────────────────

interface DayPageProps {
  dayInfo: DayInfo;
  data: FullPlanResponse;
  isRefreshing: boolean;
  onRefresh: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function DayPage({ dayInfo, data, isRefreshing, onRefresh, t }: DayPageProps) {
  const { week, day } = dayInfo;

  const isToday =
    data.currentWeek != null &&
    data.currentDayOfWeek != null &&
    dayInfo.weekNumber === data.currentWeek &&
    dayInfo.dayOfWeek === data.currentDayOfWeek;

  const dayLabel = formatDayLabel(week.weekStartDate, day.dayOfWeek);
  const totals = day.dayTotals;

  const sortedMeals = useMemo(
    () => day.meals.slice().sort((a, b) => a.order - b.order),
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
          tintColor={Colors.dark.gold}
        />
      }
    >
      {/* Day name + date */}
      <View style={styles.dayHeader}>
        <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{dayLabel}</Text>
        {isToday && (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>{t('nutrition.today')}</Text>
          </View>
        )}
      </View>

      {/* Macro summary bar */}
      {totals && <MacroBar totals={totals} t={t} />}

      {/* Meal cards */}
      {sortedMeals.length === 0 ? (
        <View style={styles.noMealsContainer}>
          <Text style={styles.noMealsText}>{t('nutrition.meals', { count: 0 })}</Text>
        </View>
      ) : (
        sortedMeals.map((meal) => (
          <MealCard
            key={meal.mealId}
            meal={meal}
          />
        ))
      )}
    </ScrollView>
  );
}

// ─── Macro Bar ───────────────────────────────────────────────────────────────

interface MacroBarProps {
  totals: NutrientTotals;
  t: (key: string) => string;
}

function MacroBar({ totals, t }: MacroBarProps) {
  return (
    <View style={styles.macroBar}>
      <MacroItem
        label={t('nutrition.kcal')}
        value={Math.round(totals.kcal)}
        unit=""
        color={Colors.dark.kcal}
      />
      <View style={styles.macroDivider} />
      <MacroItem
        label={t('nutrition.protein')}
        value={Math.round(totals.protein)}
        unit="g"
        color={Colors.dark.protein}
      />
      <View style={styles.macroDivider} />
      <MacroItem
        label={t('nutrition.carbs')}
        value={Math.round(totals.carbs)}
        unit="g"
        color={Colors.dark.carbs}
      />
      <View style={styles.macroDivider} />
      <MacroItem
        label={t('nutrition.fat')}
        value={Math.round(totals.fat)}
        unit="g"
        color={Colors.dark.fat}
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
  return (
    <View style={styles.macroItem}>
      <Text style={[styles.macroValue, { color }]}>
        {value}
        {unit}
      </Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

// ─── Meal Card ───────────────────────────────────────────────────────────────

interface MealCardProps {
  meal: PlanMeal;
}

function MealCard({ meal }: MealCardProps) {
  const [expanded, setExpanded] = useState(false);
  const kcal = meal.mealTotals?.kcal ?? 0;

  return (
    <TouchableOpacity
      style={styles.mealCard}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.75}
    >
      <View style={styles.mealCardContent}>
        <View style={styles.mealCardHeader}>
          <View style={styles.mealCardLeft}>
            <Text style={styles.mealName}>{meal.name}</Text>
            <Text style={styles.mealMeta}>
              {meal.time ? `${meal.time} · ` : ''}
              {meal.foods.length} {meal.foods.length === 1 ? 'food' : 'foods'}
              {kcal > 0 ? ` · ${Math.round(kcal)} kcal` : ''}
            </Text>
          </View>
          <Text style={[styles.mealChevron, expanded && styles.mealChevronExpanded]}>
            ›
          </Text>
        </View>

        {expanded && meal.foods.length > 0 && (
          <View style={styles.foodsList}>
            {meal.foods.map((food, idx) => {
              const scale = food.amountGrams / 100;
              return (
                <View key={`${food.foodExternalId}-${idx}`} style={styles.foodRow}>
                  <View style={styles.foodInfo}>
                    <Text style={styles.foodName}>{food.foodName}</Text>
                    <Text style={styles.foodAmount}>{Math.round(food.amountGrams)}g</Text>
                  </View>
                  <View style={styles.foodMacros}>
                    <Text style={styles.foodMacro}>{Math.round(food.nutrientValuePer100Grams.kcal * scale)}</Text>
                    <Text style={[styles.foodMacro, { color: Colors.dark.protein }]}>{Math.round(food.nutrientValuePer100Grams.protein * scale)}g</Text>
                    <Text style={[styles.foodMacro, { color: Colors.dark.carbs }]}>{Math.round(food.nutrientValuePer100Grams.carbs * scale)}g</Text>
                    <Text style={[styles.foodMacro, { color: Colors.dark.fat }]}>{Math.round(food.nutrientValuePer100Grams.fat * scale)}g</Text>
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
    backgroundColor: Colors.dark.background,
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
    color: Colors.dark.text,
  },
  shoppingBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    backgroundColor: Colors.dark.gold + '22',
    borderWidth: 1,
    borderColor: Colors.dark.gold,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  upcomingBannerText: {
    color: Colors.dark.gold,
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
    color: Colors.dark.text,
    lineHeight: 28,
  },
  weekArrowTextDisabled: {
    color: Colors.dark.text3,
  },
  weekCenter: {
    flex: 1,
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  weekRange: {
    fontSize: 12,
    color: Colors.dark.text3,
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
    color: Colors.dark.text,
  },
  dayLabelToday: {
    color: Colors.dark.gold,
  },
  todayBadge: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.dark.background,
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
    backgroundColor: Colors.dark.text3,
    opacity: 0.2,
  },
  swipeHintDotActive: {
    opacity: 1,
    backgroundColor: Colors.dark.gold,
  },

  // Macro bar
  macroBar: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.text3,
    marginTop: 2,
  },
  macroDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.border,
    marginVertical: 4,
  },

  // Meal card
  mealCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.dark.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.text,
  },
  mealMeta: {
    fontSize: 12,
    color: Colors.dark.text3,
    marginTop: 3,
  },
  mealChevron: {
    fontSize: 20,
    color: Colors.dark.text3,
    marginLeft: 8,
  },
  mealChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  foodsList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
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
    color: Colors.dark.text2,
    fontWeight: '500',
  },
  foodAmount: {
    fontSize: 11,
    color: Colors.dark.text3,
    marginTop: 1,
  },
  foodMacros: {
    flexDirection: 'row',
    gap: 10,
  },
  foodMacro: {
    fontSize: 11,
    color: Colors.dark.text3,
    minWidth: 28,
    textAlign: 'right',
  },

  // Empty states
  emptyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 24,
  },
  emptyCardText: {
    fontSize: 14,
    color: Colors.dark.text2,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.dark.text3,
    textAlign: 'center',
  },
  noMealsContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  noMealsText: {
    fontSize: 14,
    color: Colors.dark.text3,
  },
});
