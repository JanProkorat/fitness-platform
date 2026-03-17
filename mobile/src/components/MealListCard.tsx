import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import type { PlanMeal } from '../api/nutrition';

interface MealListCardProps {
  meal: PlanMeal;
  isEaten: boolean;
  onPress: () => void;
  onMarkEaten: () => void;
}

export function MealListCard({ meal, isEaten, onPress, onMarkEaten }: MealListCardProps) {
  const kcal = meal.mealTotals?.kcal ?? 0;
  const foodCount = meal.foods.length;

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

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.dark.green,
    fontWeight: '800',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  dimmed: {
    color: Colors.dark.text3,
  },
  meta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.dark.text3,
    fontWeight: '400',
  },
  eatButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  eatButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.background,
  },
});
