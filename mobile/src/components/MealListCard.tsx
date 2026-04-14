import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { PlanMeal } from '@/api/nutrition';

interface MealListCardProps {
  meal: PlanMeal;
  isEaten: boolean;
  onPress: () => void;
  onMarkEaten: () => void;
}

export function MealListCard({ meal, isEaten, onPress, onMarkEaten }: MealListCardProps) {
  const colors = useTheme();
  const kcal = meal.mealTotals?.kcal ?? 0;
  const foodCount = meal.foods.length;
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={[styles.card, isEaten && styles.cardEaten]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            {isEaten && <Text style={styles.check}>✓</Text>}
            <Text style={[styles.name, isEaten && styles.dimmed]}>{meal.name}</Text>
          </View>
          <View style={styles.meta}>
            {meal.time ? (
              <Text style={styles.metaText}>{meal.time}</Text>
            ) : null}
            <Text style={styles.metaText}>
              {Math.round(kcal)} kcal
            </Text>
            <Text style={styles.metaText}>
              {foodCount} {foodCount === 1 ? 'food' : 'foods'}
            </Text>
          </View>
        </View>
        {!isEaten && (
          <TouchableOpacity
            style={styles.eatButton}
            onPress={(e) => {
              e.stopPropagation?.();
              onMarkEaten();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.eatButtonText}>Eaten</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.bg3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.sep,
      padding: 14,
      marginBottom: 10,
    },
    cardEaten: {
      opacity: 0.6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    info: {
      flex: 1,
      marginRight: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    check: {
      fontSize: 16,
      color: colors.green,
      fontWeight: '800',
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.label,
    },
    dimmed: {
      color: colors.label3,
    },
    meta: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    metaText: {
      fontSize: 12,
      color: colors.label3,
      fontWeight: '400',
    },
    eatButton: {
      backgroundColor: colors.gold,
      borderRadius: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    eatButtonText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.bg,
    },
  });
}
