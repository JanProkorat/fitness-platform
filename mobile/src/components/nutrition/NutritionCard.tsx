import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { MacroBar } from '@/components/ui/MacroBar'
import { MealRow } from '@/components/nutrition/MealRow'
import type { NutrientTotals, PlanMeal } from '@/api/nutrition'

interface NutritionCardProps {
  consumed: NutrientTotals
  targets: {
    kcal: number
    protein: number
    carbs: number
    fat: number
  }
  meals: PlanMeal[]
  eatenMealIds: Set<string>
  onMealPress?: (mealId: string) => void
  onMarkEaten?: (mealId: string) => void
}

export function NutritionCard({
  consumed,
  targets,
  meals,
  eatenMealIds,
  onMealPress,
  onMarkEaten,
}: NutritionCardProps) {
  const colors = useTheme()

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Macro progress bars */}
      <View style={styles.macros}>
        <MacroBar
          label="Protein"
          current={consumed.protein}
          target={targets.protein}
          color={colors.blue}
        />
        <MacroBar
          label="Carbs"
          current={consumed.carbs}
          target={targets.carbs}
          color={colors.orange}
        />
        <MacroBar
          label="Fat"
          current={consumed.fat}
          target={targets.fat}
          color={colors.purple}
        />
      </View>

      {/* Meal list */}
      <View style={styles.meals}>
        {meals.map((meal) => (
          <MealRow
            key={meal.mealId}
            name={meal.name}
            kcal={meal.mealTotals?.kcal ?? 0}
            time={meal.time}
            eaten={eatenMealIds.has(meal.mealId)}
            onPress={() => onMealPress?.(meal.mealId)}
            onMarkEaten={() => onMarkEaten?.(meal.mealId)}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginHorizontal: 16,
    padding: 16,
  },
  macros: {
    marginBottom: 4,
  },
  meals: {},
})

export default NutritionCard
