import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { hrefParams } from '@/lib/navigation';
import i18n from '@/i18n';
import { getFullPlan, type FullPlanResponse, type PlanDay, type NutrientTotals } from '@/api/nutrition';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatWeekRange(startDate: string, endDate: string): string {
  const locale = i18n.language;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function getDayDate(weekStartDate: string, dayOfWeek: number): Date {
  // dayOfWeek: 1=Mon … 7=Sun; weekStartDate is always Monday
  const start = new Date(weekStartDate);
  const date = new Date(start);
  date.setDate(start.getDate() + (dayOfWeek - 1));
  return date;
}

function formatDayName(weekStartDate: string, dayOfWeek: number): string {
  const date = getDayDate(weekStartDate, dayOfWeek);
  const str = date.toLocaleDateString(i18n.language, { weekday: 'long' });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatShortDate(weekStartDate: string, dayOfWeek: number): string {
  const date = getDayDate(weekStartDate, dayOfWeek);
  return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
}

function sumTotals(totalsArr: NutrientTotals[]): NutrientTotals {
  if (totalsArr.length === 0) return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  return totalsArr.reduce(
    (acc, t) => ({
      kcal: acc.kcal + t.kcal,
      protein: acc.protein + t.protein,
      carbs: acc.carbs + t.carbs,
      fat: acc.fat + t.fat,
      fiber: acc.fiber + t.fiber,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WeekOverviewScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ weekNumber?: string }>();

  const paramWeekNumber = params.weekNumber ? parseInt(params.weekNumber, 10) : 1;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['full-plan'],
    queryFn: getFullPlan,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 404) return false;
      return failureCount < 3;
    },
  });

  const [currentWeekNumber, setCurrentWeekNumber] = useState<number>(paramWeekNumber);

  // Derive the current week object
  const currentWeekObj = useMemo(
    () => data?.weeks.find((w) => w.weekNumber === currentWeekNumber) ?? null,
    [data, currentWeekNumber],
  );

  const totalWeeks = data?.totalWeeks ?? data?.weeks.length ?? 0;

  // Published week numbers for prev/next navigation
  const publishedWeekNumbers = useMemo(
    () => data?.weeks.map((w) => w.weekNumber).sort((a, b) => a - b) ?? [],
    [data],
  );

  const currentWeekIndexInList = publishedWeekNumbers.indexOf(currentWeekNumber);
  const prevWeekNumber =
    currentWeekIndexInList > 0 ? publishedWeekNumbers[currentWeekIndexInList - 1] : null;
  const nextWeekNumber =
    currentWeekIndexInList < publishedWeekNumbers.length - 1
      ? publishedWeekNumbers[currentWeekIndexInList + 1]
      : null;

  const handleBack = () => {
    router.replace(hrefParams('/nutrition', { weekNumber: String(currentWeekNumber), dayOfWeek: '1' }));
  };

  const handlePrevWeek = () => {
    if (prevWeekNumber != null) setCurrentWeekNumber(prevWeekNumber);
  };

  const handleNextWeek = () => {
    if (nextWeekNumber != null) setCurrentWeekNumber(nextWeekNumber);
  };

  const handleDayPress = (dayOfWeek: number) => {
    router.replace(hrefParams('/nutrition', { weekNumber: String(currentWeekNumber), dayOfWeek: String(dayOfWeek) }));
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <ScreenHeader title={t('nutrition.weekOverview')} onBack={handleBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error / no data ────────────────────────────────────────────────────────

  if (isError || !data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <ScreenHeader title={t('nutrition.weekOverview')} onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.label3 }]}>{t('nutrition.noPlanMessage')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Build sorted days for current week ────────────────────────────────────

  const sortedDays: PlanDay[] = currentWeekObj
    ? currentWeekObj.days.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    : [];

  // Fill in missing days (1–7) so we always show 7 cards
  const allDays: (PlanDay | null)[] = Array.from({ length: 7 }, (_, i) => {
    const dow = i + 1;
    return sortedDays.find((d) => d.dayOfWeek === dow) ?? null;
  });

  // Average macros across days that have totals
  const daysWithTotals = allDays
    .filter((d): d is PlanDay => d != null && d.dayTotals != null)
    .map((d) => d.dayTotals as NutrientTotals);
  const weekSum = sumTotals(daysWithTotals);

  const weekStartDate = currentWeekObj?.weekStartDate ?? '';
  const weekEndDate = currentWeekObj?.weekEndDate ?? '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <ScreenHeader title={t('nutrition.weekOverview')} onBack={handleBack} />

      {/* Week bar */}
      <View style={styles.weekBar}>
        <TouchableOpacity
          style={[styles.weekArrow, prevWeekNumber == null && styles.weekArrowDisabled]}
          onPress={handlePrevWeek}
          disabled={prevWeekNumber == null}
        >
          <Text style={[styles.weekArrowText, { color: prevWeekNumber == null ? colors.label3 : colors.label }]}>
            ‹
          </Text>
        </TouchableOpacity>

        <View style={styles.weekCenter}>
          <Text style={[styles.weekLabel, { color: colors.label }]}>
            {t('nutrition.weekLabel', { current: currentWeekNumber, total: totalWeeks })}
          </Text>
          {weekStartDate !== '' && (
            <Text style={[styles.weekRange, { color: colors.label3 }]}>
              {formatWeekRange(weekStartDate, weekEndDate)}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.weekArrow, nextWeekNumber == null && styles.weekArrowDisabled]}
          onPress={handleNextWeek}
          disabled={nextWeekNumber == null}
        >
          <Text style={[styles.weekArrowText, { color: nextWeekNumber == null ? colors.label3 : colors.label }]}>
            ›
          </Text>
        </TouchableOpacity>
      </View>

      {/* Day cards + week sum */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Week sum */}
        <WeekSumRow totals={weekSum} t={t} />
        <View style={styles.weekSumSpacer} />

        {/* Day cards */}
        {allDays.map((day, index) => {
          const dayOfWeek = index + 1;
          const isToday =
            data.currentWeek != null &&
            data.currentDayOfWeek != null &&
            currentWeekNumber === data.currentWeek &&
            dayOfWeek === data.currentDayOfWeek;

          return (
            <DayCard
              key={dayOfWeek}
              dayOfWeek={dayOfWeek}
              day={day}
              weekStartDate={weekStartDate}
              isToday={isToday}
              onPress={() => handleDayPress(dayOfWeek)}
              t={t}
            />
          );
        })}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen Header ────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
}

function ScreenHeader({ title, onBack }: ScreenHeaderProps) {
  const colors = useTheme();
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Text style={[styles.backBtnText, { color: colors.label }]}>‹</Text>
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.label }]}>{title}</Text>
      {/* Spacer to keep title centered */}
      <View style={styles.headerSpacer} />
    </View>
  );
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

interface DayCardProps {
  dayOfWeek: number;
  day: PlanDay | null;
  weekStartDate: string;
  isToday: boolean;
  onPress: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

function DayCard({ dayOfWeek, day, weekStartDate, isToday, onPress, t }: DayCardProps) {
  const colors = useTheme();
  const dayName = weekStartDate ? formatDayName(weekStartDate, dayOfWeek) : '';
  const shortDate = weekStartDate ? formatShortDate(weekStartDate, dayOfWeek) : '';
  const mealCount = day?.meals.length ?? 0;
  const totals = day?.dayTotals ?? null;

  return (
    <TouchableOpacity
      style={[styles.dayCard, { backgroundColor: colors.bg2, borderColor: isToday ? colors.gold : colors.sep }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Today gold left border */}
      {isToday && <View style={[styles.todayBorder, { backgroundColor: colors.gold }]} />}

      <View style={styles.dayCardInner}>
        {/* Top row: day name + date + TODAY badge */}
        <View style={styles.dayCardTop}>
          <View style={styles.dayCardTitleRow}>
            <Text style={[styles.dayName, { color: isToday ? colors.gold : colors.label }]}>{dayName}</Text>
            <Text style={[styles.dayDate, { color: colors.label3 }]}>{shortDate}</Text>
          </View>
          {isToday && (
            <View style={[styles.todayBadge, { backgroundColor: colors.gold }]}>
              <Text style={[styles.todayBadgeText, { color: colors.bg }]}>{t('nutrition.today')}</Text>
            </View>
          )}
        </View>

        {/* Meal count */}
        <Text style={[styles.mealCount, { color: colors.label3 }]}>
          {t('nutrition.meals', { count: mealCount })}
        </Text>

        {/* Macro row */}
        {totals ? (
          <View style={styles.macroRow}>
            <MacroChip
              label={t('nutrition.kcal')}
              value={Math.round(totals.kcal)}
              unit=""
              color={colors.orange}
            />
            <MacroChip
              label={t('nutrition.proteinShort')}
              value={Math.round(totals.protein)}
              unit="g"
              color={colors.macroProtein}
            />
            <MacroChip
              label={t('nutrition.carbsShort')}
              value={Math.round(totals.carbs)}
              unit="g"
              color={colors.macroCarbs}
            />
            <MacroChip
              label={t('nutrition.fatShort')}
              value={Math.round(totals.fat)}
              unit="g"
              color={colors.macroFat}
            />
          </View>
        ) : (
          <Text style={[styles.noMacros, { color: colors.label3 }]}>—</Text>
        )}
      </View>

      <Text style={[styles.cardChevron, { color: colors.label3 }]}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Macro Chip ───────────────────────────────────────────────────────────────

interface MacroChipProps {
  label: string;
  value: number;
  unit: string;
  color: string;
}

function MacroChip({ label, value, unit, color }: MacroChipProps) {
  const colors = useTheme();
  return (
    <View style={styles.macroChip}>
      <Text style={[styles.macroChipValue, { color }]}>
        {value}{unit}
      </Text>
      <Text style={[styles.macroChipLabel, { color: colors.label3 }]}>{label}</Text>
    </View>
  );
}

// ─── Week Sum Row ─────────────────────────────────────────────────────────────

interface WeekSumRowProps {
  totals: NutrientTotals;
  t: (key: string) => string;
}

function WeekSumRow({ totals, t }: WeekSumRowProps) {
  const colors = useTheme();
  return (
    <View style={[styles.averageRow, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
      <Text style={[styles.averageLabel, { color: colors.gold }]}>{t('nutrition.weekTotal')}</Text>
      <View style={styles.averageMacros}>
        <MacroChip
          label={t('nutrition.kcal')}
          value={Math.round(totals.kcal)}
          unit=""
          color={colors.orange}
        />
        <MacroChip
          label="P"
          value={Math.round(totals.protein)}
          unit="g"
          color={colors.macroProtein}
        />
        <MacroChip
          label="C"
          value={Math.round(totals.carbs)}
          unit="g"
          color={colors.macroCarbs}
        />
        <MacroChip
          label="F"
          value={Math.round(totals.fat)}
          unit="g"
          color={colors.macroFat}
        />
      </View>
    </View>
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
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 28,
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 44,
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

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  bottomSpacer: {
    height: 32,
  },

  // Day card
  dayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayCardToday: {},
  todayBorder: {
    width: 4,
    alignSelf: 'stretch',
  },
  dayCardInner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dayCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  dayName: {
    fontSize: 15,
    fontWeight: '700',
  },
  dayNameToday: {},
  dayDate: {
    fontSize: 12,
  },
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
  mealCount: {
    fontSize: 12,
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  noMacros: {
    fontSize: 13,
  },
  cardChevron: {
    fontSize: 20,
    paddingRight: 14,
  },

  // Macro chip
  macroChip: {
    alignItems: 'center',
    minWidth: 44,
  },
  macroChipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  macroChipLabel: {
    fontSize: 10,
    marginTop: 1,
  },

  // Average row
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 6,
  },
  averageLabel: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  averageMacros: {
    flexDirection: 'row',
    gap: 12,
  },
  weekSumSpacer: {
    height: 16,
  },
});
