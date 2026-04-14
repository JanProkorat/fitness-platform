import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/useTheme';
import { addPendingMutation } from '@/stores/offline';
import {
  logMealEaten,
  type TodayPlanResponse,
  type TodayLogResponse,
  type MealFood,
} from '@/api/nutrition';

export default function MealDetailScreen() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const router = useRouter();
  const colors = useTheme();
  const queryClient = useQueryClient();
  const isConnected = useNetworkStatus();
  const { t } = useTranslation();

  const plan = queryClient.getQueryData<TodayPlanResponse>(['today-plan']);
  const log = queryClient.getQueryData<TodayLogResponse>(['today-log']);

  const meal = useMemo(
    () => plan?.meals.find((m) => m.mealId === mealId),
    [plan, mealId],
  );

  const isEaten = useMemo(
    () => log?.mealsEaten.some((m) => m.mealId === mealId) ?? false,
    [log, mealId],
  );

  const markEatenMutation = useMutation({
    mutationFn: logMealEaten,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] });
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log']);

      if (previous && meal) {
        const newEntry = {
          mealId: id,
          mealName: meal.name ?? '',
          eatenAt: new Date().toISOString(),
          totals: meal.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        };
        const totals = meal.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        queryClient.setQueryData<TodayLogResponse>(['today-log'], {
          ...previous,
          mealsEaten: [...previous.mealsEaten, newEntry],
          totalConsumed: {
            kcal: previous.totalConsumed.kcal + totals.kcal,
            protein: previous.totalConsumed.protein + totals.protein,
            carbs: previous.totalConsumed.carbs + totals.carbs,
            fat: previous.totalConsumed.fat + totals.fat,
            fiber: previous.totalConsumed.fiber + totals.fiber,
          },
        });
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-log'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['today-plan'] });
      queryClient.invalidateQueries({ queryKey: ['today-log'] });
    },
  });

  const handleMarkEaten = useCallback(() => {
    if (!mealId) return;
    if (isConnected) {
      markEatenMutation.mutate(mealId);
    } else {
      addPendingMutation({
        method: 'POST',
        url: `/client/nutrition/log/meals/${mealId}/eaten`,
      });
      // Optimistic offline update
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log']);
      if (previous && meal) {
        const totals = meal.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
        queryClient.setQueryData<TodayLogResponse>(['today-log'], {
          ...previous,
          mealsEaten: [
            ...previous.mealsEaten,
            {
              mealId,
              mealName: meal.name ?? '',
              eatenAt: new Date().toISOString(),
              totals,
            },
          ],
          totalConsumed: {
            kcal: previous.totalConsumed.kcal + totals.kcal,
            protein: previous.totalConsumed.protein + totals.protein,
            carbs: previous.totalConsumed.carbs + totals.carbs,
            fat: previous.totalConsumed.fat + totals.fat,
            fiber: previous.totalConsumed.fiber + totals.fiber,
          },
        });
      }
    }
  }, [isConnected, mealId, markEatenMutation, queryClient, meal]);

  if (!meal) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={[styles.headerBar, { borderBottomColor: colors.sep }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: colors.gold }]}>{'< Back'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.label3 }]}>Meal not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mealTotals = meal.mealTotals ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

  const renderFoodItem = ({ item }: { item: MealFood }) => {
    const factor = item.amountGrams / 100;
    const kcal = Math.round(item.nutrientValuePer100Grams.kcal * factor);
    const protein = Math.round(item.nutrientValuePer100Grams.protein * factor * 10) / 10;
    const carbs = Math.round(item.nutrientValuePer100Grams.carbs * factor * 10) / 10;
    const fat = Math.round(item.nutrientValuePer100Grams.fat * factor * 10) / 10;

    return (
      <View style={[styles.foodCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
        <View style={styles.foodHeader}>
          <Text style={[styles.foodName, { color: colors.label }]} numberOfLines={2}>
            {item.foodName}
          </Text>
          <Text style={[styles.foodAmount, { color: colors.label2 }]}>{Math.round(item.amountGrams)} g</Text>
        </View>
        <View style={styles.foodMacros}>
          <Text style={[styles.foodMacro, { color: colors.orange }]}>
            {kcal} kcal
          </Text>
          <Text style={[styles.foodMacro, { color: colors.macroProtein }]}>
            {protein}g P
          </Text>
          <Text style={[styles.foodMacro, { color: colors.macroCarbs }]}>
            {carbs}g C
          </Text>
          <Text style={[styles.foodMacro, { color: colors.macroFat }]}>
            {fat}g F
          </Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Meal totals summary */}
      <View style={[styles.totalsCard, { backgroundColor: colors.bg2, borderColor: colors.sep }]}>
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: colors.orange }]}>
            {Math.round(mealTotals.kcal)}
          </Text>
          <Text style={[styles.totalLabel, { color: colors.label3 }]}>kcal</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: colors.macroProtein }]}>
            {Math.round(mealTotals.protein)}g
          </Text>
          <Text style={[styles.totalLabel, { color: colors.label3 }]}>Protein</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: colors.macroCarbs }]}>
            {Math.round(mealTotals.carbs)}g
          </Text>
          <Text style={[styles.totalLabel, { color: colors.label3 }]}>Carbs</Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={[styles.totalValue, { color: colors.macroFat }]}>
            {Math.round(mealTotals.fat)}g
          </Text>
          <Text style={[styles.totalLabel, { color: colors.label3 }]}>Fat</Text>
        </View>
      </View>

      {/* Foods section header */}
      <Text style={[styles.foodsTitle, { color: colors.label }]}>
        Foods ({meal.foods.length})
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Top bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.sep }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.gold }]}>{'< Back'}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.label }]} numberOfLines={1}>
            {meal.name || (meal.kind ? t(`nutrition.mealKind.${meal.kind}`) : '')}
          </Text>
          {meal.time ? (
            <Text style={[styles.headerTime, { color: colors.label3 }]}>{meal.time}</Text>
          ) : null}
        </View>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={meal.foods}
        keyExtractor={(item) => item.foodExternalId}
        renderItem={renderFoodItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom action */}
      {!isEaten && (
        <View style={[styles.bottomBar, { borderTopColor: colors.sep, backgroundColor: colors.bg2 }]}>
          <TouchableOpacity
            style={[styles.eatButton, { backgroundColor: colors.gold }]}
            onPress={handleMarkEaten}
            activeOpacity={0.7}
            disabled={markEatenMutation.isPending}
          >
            {markEatenMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <Text style={[styles.eatButtonText, { color: colors.bg }]}>Mark as Eaten</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {isEaten && (
        <View style={[styles.bottomBar, { borderTopColor: colors.sep, backgroundColor: colors.bg2 }]}>
          <View style={[styles.eatenBadge, { backgroundColor: colors.bg2, borderColor: colors.green }]}>
            <Text style={[styles.eatenText, { color: colors.green }]}>✓ Eaten</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
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
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerTime: {
    fontSize: 12,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  totalsCard: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  foodsTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  foodCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  foodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  foodName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  foodAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  foodMacros: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  foodMacro: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  eatButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  eatButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  eatenBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  eatenText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
