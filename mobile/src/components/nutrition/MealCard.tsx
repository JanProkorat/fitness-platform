import React, { useCallback, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { useRouter, useSegments } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { hrefParams } from '@/lib/navigation'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { getMealKindConfig } from '@/constants/mealKinds'
import { NoteBanner } from '@/components/ui/NoteBanner'
import type { MealFood, MealRecipe, PlanMeal } from '@/api/nutrition'
import i18n from '@/i18n'
import {
  computeFoodKcal,
  computeRecipeKcal,
  totalMealItems,
} from '@/lib/nutrition-plan-helpers'

const ANIM_DURATION = 250
const ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1)

interface MealCardProps {
  meal: PlanMeal
  expanded: boolean
  onToggle: () => void
  /** Whether this meal has been logged as eaten (shows a checkmark badge). */
  eaten?: boolean
}

function MealCard({ meal, expanded, onToggle, eaten }: MealCardProps) {
  const { t } = useTranslation()
  const colors = useTheme()
  const kindConfig = getMealKindConfig(meal.kind)
  const kcal = meal.mealTotals?.kcal ?? 0
  const itemCount = totalMealItems(meal)
  const isDark = colors.bg === '#1c1c1e'
  const tint = isDark ? kindConfig.tintDark : kindConfig.tintLight

  const mealLabel =
    (meal.kind ? t(`nutrition.mealKind.${meal.kind}`) : meal.name) ?? ''

  // Animated accordion: content is always rendered for measurement
  const contentHeight = useSharedValue(0)
  const measuredHeight = useRef(0)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      // On first render, set immediately without animation
      contentHeight.value = expanded ? (measuredHeight.current || 0) : 0
      return
    }
    contentHeight.value = withTiming(
      expanded ? measuredHeight.current : 0,
      { duration: ANIM_DURATION, easing: ANIM_EASING },
    )
  }, [expanded])

  const animatedBodyStyle = useAnimatedStyle(() => ({
    height: contentHeight.value,
  }))

  const handleLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height
    if (h > 0 && h !== measuredHeight.current) {
      measuredHeight.current = h
      if (expanded) {
        contentHeight.value = h
      }
    }
  }, [expanded])

  return (
    <View style={[styles.mealCard, { backgroundColor: colors.bg2 }]}>
      <Pressable onPress={onToggle}>
        <View style={styles.mealCardHeader}>
          <View style={[styles.mealIcon, { backgroundColor: tint }]}>
            <Text style={styles.mealIconText}>{kindConfig.icon}</Text>
          </View>
          <View style={styles.mealCardInfo}>
            <Text style={[styles.mealName, { color: colors.label }]}>
              {mealLabel}
            </Text>
            <Text style={[styles.mealMeta, { color: colors.label2 }]}>
              {meal.time ? `${meal.time} · ` : ''}
              {t('nutrition.items', { count: itemCount })}
            </Text>
          </View>
          <View style={styles.mealCardRight}>
            <Text style={[styles.mealKcal, { color: colors.label }]}>
              {Math.round(kcal)} kcal
            </Text>
            {meal.mealTotals && (
              <Text style={styles.mealMacroSummary}>
                <Text style={{ color: colors.macroProtein, fontWeight: '600' }}>{t('nutrition.proteinShort')} {Math.round(meal.mealTotals.protein)}</Text>
                <Text style={{ color: colors.label3 }}> · </Text>
                <Text style={{ color: colors.macroCarbs, fontWeight: '600' }}>{t('nutrition.carbsShort')} {Math.round(meal.mealTotals.carbs)}</Text>
                <Text style={{ color: colors.label3 }}> · </Text>
                <Text style={{ color: colors.macroFat, fontWeight: '600' }}>{t('nutrition.fatShort')} {Math.round(meal.mealTotals.fat)}</Text>
                <Text style={{ color: colors.label3 }}> · </Text>
                <Text style={{ color: colors.macroFiber, fontWeight: '600' }}>{t('nutrition.fiberShort')} {Math.round(meal.mealTotals.fiber)}</Text>
              </Text>
            )}
          </View>
          {eaten && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.green}
              style={{ marginLeft: 8 }}
            />
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.label3}
            style={styles.mealChevron}
          />
        </View>
      </Pressable>

      <Animated.View style={[styles.mealBodyClip, animatedBodyStyle]}>
        <View
          onLayout={handleLayout}
          style={[styles.mealBodyInner, { borderTopColor: colors.sep2 }]}
        >
          {/* Foods */}
          {meal.foods.map((food, idx) => (
            <FoodItemRow key={`f-${food.foodExternalId}-${idx}`} food={food} mealName={mealLabel} />
          ))}

          {/* Recipes */}
          {meal.recipes?.map((recipe, idx) => (
            <RecipeItemRow key={`r-${recipe.recipeId}-${idx}`} recipe={recipe} mealName={mealLabel} />
          ))}

          {/* Meal note */}
          {meal.note && (
            <View
              style={[
                styles.mealNote,
                { borderTopColor: colors.sep2, backgroundColor: colors.goldBg },
              ]}
            >
              <Text style={[styles.mealNoteText, { color: colors.label2 }]}>
                <Text style={{ fontWeight: '600', color: colors.gold }}>
                  {t('nutrition.tip')}{' '}
                </Text>
                {meal.note}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  )
}

function FoodItemRow({ food, mealName }: { food: MealFood; mealName: string }) {
  const { t } = useTranslation()
  const colors = useTheme()
  const router = useRouter()
  const segments = useSegments()
  // Pick the closest stack so the detail pushes with a slide animation:
  //   plans tab   → push inside /(client)/plans
  //   nutrition   → push inside /(client)/nutrition
  //   otherwise   → (e.g. Today tab) push at the client root so we don't
  //   cross-jump between tabs (which has no push animation).
  const segs = segments as string[]
  const basePath = segs.includes('plans')
    ? '/(client)/plans'
    : segs.includes('nutrition')
      ? '/(client)/nutrition'
      : '/(client)'
  // Back-button label matches where we came from. Today tab = "Home".
  const backLabel = segs.includes('plans')
    ? t('nutrition.plan')
    : segs.includes('nutrition')
      ? t('nutrition.plan')
      : t('tabs.today')
  const kcal = computeFoodKcal(food)

  // Use localized food name if available, fallback to default name
  const foodName =
    (i18n.language === 'cs' && food.foodNameCs) ||
    (i18n.language === 'de' && food.foodNameDe) ||
    (i18n.language === 'en' && food.foodNameEn) ||
    food.foodName

  const categoryLabel = food.foodCategory
    ? t(`nutrition.foodCategory.${food.foodCategory}`, { defaultValue: food.foodCategory })
    : null

  const handlePress = () => {
    router.push(
      hrefParams(`${basePath}/food-detail`, {
        food: JSON.stringify(food),
        mealName,
        backLabel,
      }),
    )
  }

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }}>
      <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <View style={styles.foodRow}>
          <View style={styles.foodRowInfo}>
            <Text style={[styles.foodRowName, { color: colors.label }]} numberOfLines={1}>
              {foodName}
            </Text>
            {categoryLabel && (
              <Text style={[styles.foodRowSub, { color: colors.label2 }]} numberOfLines={1}>
                {categoryLabel}
              </Text>
            )}
          </View>
          <View style={styles.foodRowRight}>
            <Text style={[styles.foodRowKcal, { color: colors.label }]}>
              {Math.round(kcal)} kcal
            </Text>
            <Text style={[styles.foodRowGrams, { color: colors.label3 }]}>
              {Math.round(food.amountGrams)} g
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.label3} style={{ marginLeft: 2 }} />
        </View>
        {food.note ? (
          <NoteBanner variant="ingredient" label={t('nutrition.tip')}>
            {food.note}
          </NoteBanner>
        ) : null}
      </Pressable>
    </View>
  )
}

function RecipeItemRow({ recipe, mealName }: { recipe: MealRecipe; mealName: string }) {
  const { t } = useTranslation()
  const colors = useTheme()
  const router = useRouter()
  const segments = useSegments()
  const segs = segments as string[]
  const basePath = segs.includes('plans')
    ? '/(client)/plans'
    : segs.includes('nutrition')
      ? '/(client)/nutrition'
      : '/(client)'
  const backLabel = segs.includes('plans')
    ? t('nutrition.plan')
    : segs.includes('nutrition')
      ? t('nutrition.plan')
      : t('tabs.today')
  const kcal = computeRecipeKcal(recipe)

  const handlePress = () => {
    router.push(
      hrefParams(`${basePath}/recipe-detail`, {
        recipe: JSON.stringify(recipe),
        mealName,
        backLabel,
      }),
    )
  }

  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 }}>
      <Pressable onPress={handlePress} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <View style={styles.foodRow}>
          <View style={styles.foodRowInfo}>
            <Text
              style={[styles.foodRowName, { color: colors.label }]}
              numberOfLines={1}
            >
              {recipe.recipeName}
            </Text>
            <Text style={[styles.foodRowSub, { color: colors.label2 }]} numberOfLines={1}>
              {t('nutrition.recipe')}
            </Text>
          </View>
          <View style={styles.foodRowRight}>
            <Text style={[styles.foodRowKcal, { color: colors.label }]}>
              {Math.round(kcal)} kcal
            </Text>
            <Text style={[styles.foodRowGrams, { color: colors.label3 }]}>
              {t('nutrition.serving', { count: recipe.servings })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.label3} style={{ marginLeft: 2 }} />
        </View>
        {recipe.note ? (
          <NoteBanner variant="ingredient" label={t('nutrition.tip')}>
            {recipe.note}
          </NoteBanner>
        ) : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // Meal card
  mealCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    // Android shadow
    elevation: 6,
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealIconText: {
    fontSize: 18,
  },
  mealCardInfo: {
    flex: 1,
  },
  mealName: {
    ...Type.callout,
    fontWeight: '600',
  },
  mealMeta: {
    ...Type.caption1,
    marginTop: 1,
  },
  mealCardRight: {
    alignItems: 'flex-end',
    marginRight: 2,
  },
  mealKcal: {
    ...Type.callout,
    fontWeight: '700',
  },
  mealMacroSummary: {
    ...Type.caption1,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  mealChevron: {
    marginLeft: -4,
  },

  // Meal body (expanded)
  mealBodyClip: {
    overflow: 'hidden',
  },
  mealBodyInner: {
    borderTopWidth: StyleSheet.hairlineWidth,
    // Positioned at top so clip reveals from top down
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  // Food row
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  foodRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  foodRowName: {
    ...Type.subheadline,
    fontWeight: '500',
  },
  foodRowSub: {
    ...Type.caption1,
    marginTop: 1,
  },
  foodRowRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  foodRowKcal: {
    ...Type.footnote,
    fontWeight: '600',
  },
  foodRowGrams: {
    ...Type.caption2,
    marginTop: 1,
  },

  // Meal note
  mealNote: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mealNoteText: {
    ...Type.caption1,
    lineHeight: 18,
  },
})

export { MealCard, FoodItemRow, RecipeItemRow }
export default MealCard
