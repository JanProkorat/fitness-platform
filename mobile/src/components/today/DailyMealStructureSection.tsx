import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { PlanMeal, NutrientTotals } from '@/api/nutrition'

interface DailyMealStructureSectionProps {
  meals: PlanMeal[]
  dayTotals: NutrientTotals | null
}

const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  snack: '🍎',
  lunch: '🌞',
  dinner: '🌙',
}
const DEFAULT_ICON = '🍽️'

/**
 * The backend PlanMeal document stores `kind` (MealKind enum string)
 * but the mobile PlanMeal type declares `name`. At runtime the JSON
 * field is `kind`, so we read both to be safe.
 */
function getMealLabel(meal: PlanMeal): string {
  return meal.name ?? (meal as unknown as Record<string, string>).kind ?? ''
}

function getMealIcon(label: string, index: number): string {
  if (!label) {
    const positional = ['🌅', '🍎', '🌞', '🌰', '🌙']
    return positional[index] ?? DEFAULT_ICON
  }
  const lower = label.toLowerCase()
  for (const [key, icon] of Object.entries(MEAL_ICONS)) {
    if (lower.includes(key)) return icon
  }
  const positional = ['🌅', '🍎', '🌞', '🌰', '🌙']
  return positional[index] ?? DEFAULT_ICON
}

function getFoodSummary(meal: PlanMeal): string {
  return meal.foods.map((f) => f.foodName).join(', ')
}

export function DailyMealStructureSection({ meals, dayTotals }: DailyMealStructureSectionProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const sorted = [...meals].sort((a, b) => a.order - b.order)

  // Calculate totals from meals if dayTotals not provided
  const totals = dayTotals ?? sorted.reduce<NutrientTotals>(
    (acc, m) => ({
      kcal: acc.kcal + (m.mealTotals?.kcal ?? 0),
      protein: acc.protein + (m.mealTotals?.protein ?? 0),
      carbs: acc.carbs + (m.mealTotals?.carbs ?? 0),
      fat: acc.fat + (m.mealTotals?.fat ?? 0),
      fiber: acc.fiber + (m.mealTotals?.fiber ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  )

  return (
    <View>
      <SectionHeader title={t('today.dailyMealStructure')} />
      <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
        {sorted.map((meal, i) => {
          const label = getMealLabel(meal)
          return (
          <View
            key={meal.mealId}
            style={[
              styles.mealRow,
              i < sorted.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.sep2,
              },
            ]}
          >
            {/* Icon */}
            <View style={styles.mealIcon}>
              <Text style={styles.mealEmoji}>{getMealIcon(label, i)}</Text>
            </View>

            {/* Body */}
            <View style={styles.mealBody}>
              <View style={styles.mealNameRow}>
                <Text style={[styles.mealName, { color: colors.label }]}>
                  {label}
                </Text>
                {meal.time ? (
                  <Text style={[styles.mealTime, { color: colors.label3 }]}>
                    {meal.time}
                  </Text>
                ) : null}
              </View>
              {meal.foods.length > 0 && (
                <Text
                  style={[styles.mealNote, { color: colors.label2 }]}
                  numberOfLines={1}
                >
                  {getFoodSummary(meal)}
                </Text>
              )}
              {meal.mealTotals && (
                <View style={styles.macroRow}>
                  <Text style={[styles.macroLabel, { color: colors.blue }]}>
                    {t('today.macroP')} {Math.round(meal.mealTotals.protein)}g
                  </Text>
                  <Text style={[styles.macroLabel, { color: colors.orange }]}>
                    {t('today.macroC')} {Math.round(meal.mealTotals.carbs)}g
                  </Text>
                  <Text style={[styles.macroLabel, { color: colors.purple }]}>
                    {t('today.macroF')} {Math.round(meal.mealTotals.fat)}g
                  </Text>
                  <Text style={[styles.macroLabel, { color: colors.green }]}>
                    {t('today.macroFi')} {Math.round(meal.mealTotals.fiber)}g
                  </Text>
                </View>
              )}
            </View>

            {/* Kcal */}
            {meal.mealTotals && (
              <Text style={[styles.mealKcal, { color: colors.label }]}>
                {Math.round(meal.mealTotals.kcal)} kcal
              </Text>
            )}
          </View>
          )
        })}

        {/* Total row */}
        <View style={[styles.totalRow, { borderTopColor: colors.sep, backgroundColor: 'rgba(120,120,128,0.2)' }]}>
          <Text style={[styles.totalLabel, { color: colors.label2 }]}>
            {t('today.total')}
          </Text>
          <View style={styles.totalMacros}>
            <Text style={[styles.macroLabel, { color: colors.blue }]}>
              {t('today.macroP')} {Math.round(totals.protein)}g
            </Text>
            <Text style={[styles.macroLabel, { color: colors.orange }]}>
              {t('today.macroC')} {Math.round(totals.carbs)}g
            </Text>
            <Text style={[styles.macroLabel, { color: colors.purple }]}>
              {t('today.macroF')} {Math.round(totals.fat)}g
            </Text>
            <Text style={[styles.macroLabel, { color: colors.green }]}>
              {t('today.macroFi')} {Math.round(totals.fiber)}g
            </Text>
            <Text style={[styles.totalKcal, { color: colors.label }]}>
              {Math.round(totals.kcal)} kcal
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default DailyMealStructureSection

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  // Meal row
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  mealIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(52,199,89,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealEmoji: {
    fontSize: 17,
  },
  mealBody: {
    flex: 1,
    minWidth: 0,
  },
  mealNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
  },
  mealTime: {
    fontSize: 12,
  },
  mealNote: {
    fontSize: 12,
    marginBottom: 4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  mealKcal: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  // Total row
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalMacros: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  totalKcal: {
    fontSize: 13,
    fontWeight: '700',
  },
})
