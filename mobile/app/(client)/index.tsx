import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../src/stores/auth';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { addPendingMutation } from '../../src/stores/offline';
import { Colors } from '../../constants/Colors';
import { CalorieCircle } from '../../src/components/CalorieCircle';
import { MacroCard } from '../../src/components/MacroCard';
import { MealListCard } from '../../src/components/MealListCard';
import {
  getTodayPlan,
  getTodayLog,
  logMealEaten,
  type TodayPlanResponse,
  type TodayLogResponse,
  type PlanMeal,
} from '../../src/api/nutrition';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TodayScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const queryClient = useQueryClient();
  const isConnected = useNetworkStatus();

  const planQuery = useQuery<TodayPlanResponse>({
    queryKey: ['today-plan'],
    queryFn: getTodayPlan,
  });

  const logQuery = useQuery<TodayLogResponse>({
    queryKey: ['today-log'],
    queryFn: getTodayLog,
  });

  const eatenMealIds = useMemo(() => {
    const set = new Set<string>();
    logQuery.data?.mealsEaten?.forEach((m) => set.add(m.mealId));
    return set;
  }, [logQuery.data]);

  const markEatenMutation = useMutation({
    mutationFn: logMealEaten,
    onMutate: async (mealId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['today-log'] });
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log']);

      // Optimistic update
      if (previous) {
        const meal = planQuery.data?.meals.find((m) => m.mealId === mealId);
        const newEntry = {
          mealId,
          mealName: meal?.name ?? '',
          eatenAt: new Date().toISOString(),
          totals: meal?.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
        };
        const updatedConsumed = {
          kcal: previous.totalConsumed.kcal + newEntry.totals.kcal,
          protein: previous.totalConsumed.protein + newEntry.totals.protein,
          carbs: previous.totalConsumed.carbs + newEntry.totals.carbs,
          fat: previous.totalConsumed.fat + newEntry.totals.fat,
        };
        queryClient.setQueryData<TodayLogResponse>(['today-log'], {
          ...previous,
          mealsEaten: [...previous.mealsEaten, newEntry],
          totalConsumed: updatedConsumed,
        });
      }

      return { previous };
    },
    onError: (_err, _mealId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-log'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      queryClient.invalidateQueries({ queryKey: ['today-log'] });
    },
  });

  const handleMarkEaten = useCallback(
    (mealId: string) => {
      if (isConnected) {
        markEatenMutation.mutate(mealId);
      } else {
        // Offline: queue and optimistically update
        addPendingMutation({
          method: 'POST',
          url: `/client/nutrition/log/meals/${mealId}/eaten`,
        });
        // Optimistic update for offline
        const previous = queryClient.getQueryData<TodayLogResponse>(['today-log']);
        if (previous) {
          const meal = planQuery.data?.meals.find((m) => m.mealId === mealId);
          const newEntry = {
            mealId,
            mealName: meal?.name ?? '',
            eatenAt: new Date().toISOString(),
            totals: meal?.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 },
          };
          queryClient.setQueryData<TodayLogResponse>(['today-log'], {
            ...previous,
            mealsEaten: [...previous.mealsEaten, newEntry],
            totalConsumed: {
              kcal: previous.totalConsumed.kcal + newEntry.totals.kcal,
              protein: previous.totalConsumed.protein + newEntry.totals.protein,
              carbs: previous.totalConsumed.carbs + newEntry.totals.carbs,
              fat: previous.totalConsumed.fat + newEntry.totals.fat,
            },
          });
        }
      }
    },
    [isConnected, markEatenMutation, queryClient, planQuery.data],
  );

  const isLoading = planQuery.isLoading || logQuery.isLoading;
  const isRefreshing = planQuery.isRefetching || logQuery.isRefetching;
  const hasNoPlan = !planQuery.isLoading && !planQuery.data;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['today-plan'] });
    queryClient.invalidateQueries({ queryKey: ['today-log'] });
  }, [queryClient]);

  const plan = planQuery.data;
  const log = logQuery.data;
  const consumed = log?.totalConsumed ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const settings = plan?.globalSettings;
  const targetKcal = settings?.dailyKcal ?? 0;
  const targetProtein = settings?.proteinGrams ?? 0;
  const targetCarbs = settings?.carbsGrams ?? 0;
  const targetFat = settings?.fatGrams ?? 0;

  const sortedMeals = useMemo(
    () => [...(plan?.meals ?? [])].sort((a, b) => a.order - b.order),
    [plan?.meals],
  );

  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleLogout = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              Hello, <Text style={styles.name}>{user?.firstName}</Text>
            </Text>
            <Text style={styles.subtitle}>{dateString}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Empty state */}
      {(planQuery.isError || (!planQuery.isLoading && !planQuery.data)) && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyTitle}>{t('nutrition.title')}</Text>
          <Text style={styles.emptyMessage}>{t('nutrition.noPlanMessage')}</Text>
        </View>
      )}

      {/* Calorie Circle */}
      {planQuery.data && (
        <View style={styles.circleContainer}>
          <CalorieCircle consumed={consumed.kcal} target={targetKcal} />
        </View>
      )}

      {/* Macro Cards */}
      {planQuery.data && (
        <View style={styles.macroRow}>
          <MacroCard
            label="Protein"
            current={consumed.protein}
            target={targetProtein}
            color={Colors.dark.protein}
          />
          <View style={styles.macroGap} />
          <MacroCard
            label="Carbs"
            current={consumed.carbs}
            target={targetCarbs}
            color={Colors.dark.carbs}
          />
          <View style={styles.macroGap} />
          <MacroCard
            label="Fat"
            current={consumed.fat}
            target={targetFat}
            color={Colors.dark.fat}
          />
        </View>
      )}

      {/* Meals section header */}
      {planQuery.data && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meals</Text>
          <Text style={styles.sectionMeta}>
            {eatenMealIds.size} / {sortedMeals.length} eaten
          </Text>
        </View>
      )}
    </View>
  );

  const renderMeal = ({ item }: { item: PlanMeal }) => (
    <MealListCard
      meal={item}
      isEaten={eatenMealIds.has(item.mealId)}
      onPress={() => router.push(`/(client)/nutrition/${item.mealId}`)}
      onMarkEaten={() => handleMarkEaten(item.mealId)}
    />
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.dark.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={planQuery.isError || hasNoPlan ? [] : sortedMeals}
        keyExtractor={(item) => item.mealId}
        renderItem={renderMeal}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 4,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  name: {
    color: Colors.dark.gold,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.text3,
    marginTop: 4,
  },
  circleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  macroRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  macroGap: {
    width: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text3,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyCard: {
    margin: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 32,
    alignItems: 'center' as const,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.dark.text2,
    marginTop: 12,
  },
  emptyMessage: {
    fontSize: 13,
    color: Colors.dark.text3,
    marginTop: 8,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
