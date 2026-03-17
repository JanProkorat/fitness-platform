import React, { useState, useCallback, useMemo } from 'react';
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
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../../constants/Colors';
import {
  getWeekPlan,
  type PlanDay,
  type PlanMeal,
} from '../../../src/api/nutrition';

const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/** Map JS Date.getDay() (0=Sun) to our format (1=Mon ... 7=Sun). */
function getCurrentDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export default function NutritionScreen() {
  const router = useRouter();
  const [expandedDay, setExpandedDay] = useState<number | null>(
    getCurrentDayOfWeek(),
  );

  const {
    data: plan,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['week-plan'],
    queryFn: getWeekPlan,
  });

  const currentDay = useMemo(() => getCurrentDayOfWeek(), []);

  const toggleDay = useCallback((dayOfWeek: number) => {
    setExpandedDay((prev) => (prev === dayOfWeek ? null : dayOfWeek));
  }, []);

  const handleMealPress = useCallback(
    (mealId: string) => {
      router.push(`/(client)/nutrition/${mealId}`);
    },
    [router],
  );

  const handleShoppingPress = useCallback(() => {
    router.push('/(client)/nutrition/shopping');
  }, [router]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Menu</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !plan) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Menu</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyTitle}>No active nutrition plan</Text>
          <Text style={styles.emptyHint}>
            Ask your trainer to assign a nutrition plan
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Weekly Menu</Text>
            <Text style={styles.planName}>{plan.planName}</Text>
          </View>
          <TouchableOpacity
            style={styles.shoppingButton}
            onPress={handleShoppingPress}
          >
            <Text style={styles.shoppingButtonIcon}>🛒</Text>
            <Text style={styles.shoppingButtonText}>List</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.gold}
          />
        }
      >
        {plan.days
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((day) => (
            <DayCard
              key={day.dayOfWeek}
              day={day}
              isToday={day.dayOfWeek === currentDay}
              isExpanded={expandedDay === day.dayOfWeek}
              onToggle={() => toggleDay(day.dayOfWeek)}
              onMealPress={handleMealPress}
            />
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

interface DayCardProps {
  day: PlanDay;
  isToday: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onMealPress: (mealId: string) => void;
}

function DayCard({
  day,
  isToday,
  isExpanded,
  onToggle,
  onMealPress,
}: DayCardProps) {
  const dayName = DAY_NAMES[day.dayOfWeek] ?? `Day ${day.dayOfWeek}`;
  const totalKcal = day.dayTotals?.kcal ?? 0;
  const mealCount = day.meals.length;

  return (
    <View
      style={[
        styles.dayCard,
        isToday && styles.dayCardToday,
      ]}
    >
      <TouchableOpacity
        style={styles.dayHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.dayHeaderLeft}>
          <View style={styles.dayNameRow}>
            <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
              {dayName}
            </Text>
            {isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>TODAY</Text>
              </View>
            )}
          </View>
          <Text style={styles.daySummary}>
            {mealCount} {mealCount === 1 ? 'meal' : 'meals'}
            {totalKcal > 0 ? ` · ${Math.round(totalKcal)} kcal` : ''}
          </Text>
        </View>
        <Text style={styles.expandIcon}>{isExpanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.mealsContainer}>
          {day.meals
            .sort((a, b) => a.order - b.order)
            .map((meal, idx) => (
              <MealRow
                key={meal.mealId}
                meal={meal}
                isLast={idx === day.meals.length - 1}
                onPress={() => onMealPress(meal.mealId)}
              />
            ))}
          {mealCount === 0 && (
            <Text style={styles.noMeals}>No meals planned</Text>
          )}
        </View>
      )}
    </View>
  );
}

interface MealRowProps {
  meal: PlanMeal;
  isLast: boolean;
  onPress: () => void;
}

function MealRow({ meal, isLast, onPress }: MealRowProps) {
  const kcal = meal.mealTotals?.kcal ?? 0;
  const foodCount = meal.foods.length;

  return (
    <TouchableOpacity
      style={[styles.mealRow, !isLast && styles.mealRowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.mealInfo}>
        <Text style={styles.mealName}>{meal.name}</Text>
        <Text style={styles.mealMeta}>
          {meal.time ? `${meal.time} · ` : ''}
          {foodCount} {foodCount === 1 ? 'food' : 'foods'}
          {kcal > 0 ? ` · ${Math.round(kcal)} kcal` : ''}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

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
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  planName: {
    fontSize: 13,
    color: Colors.dark.text3,
    marginTop: 2,
  },
  shoppingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 12,
  },
  shoppingButtonIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  shoppingButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  dayCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 10,
    overflow: 'hidden',
  },
  dayCardToday: {
    borderColor: Colors.dark.gold,
    borderWidth: 1.5,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  dayNameToday: {
    color: Colors.dark.gold,
  },
  todayBadge: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  todayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.dark.background,
    letterSpacing: 0.5,
  },
  daySummary: {
    fontSize: 13,
    color: Colors.dark.text3,
    marginTop: 2,
  },
  expandIcon: {
    fontSize: 16,
    color: Colors.dark.text3,
    marginLeft: 8,
  },
  mealsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mealRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  mealMeta: {
    fontSize: 12,
    color: Colors.dark.text3,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: Colors.dark.text3,
    marginLeft: 8,
  },
  noMeals: {
    fontSize: 13,
    color: Colors.dark.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text3,
    marginTop: 16,
  },
  emptyHint: {
    fontSize: 13,
    color: Colors.dark.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
});
