import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native'
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
import { getFoodCategoryColor, RECIPE_CHIP_COLOR } from '@/constants/foodCategories'
import { NoteBanner } from '@/components/ui/NoteBanner'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { MealFood, MealRecipe, PlanMeal } from '@/api/nutrition'
import { goldAlpha } from '@/constants/colors'
import i18n from '@/i18n'
import {
  computeFoodKcal,
  computeRecipeKcal,
  totalMealItems,
} from '@/lib/nutrition-plan-helpers'

const ANIM_DURATION = 250
const ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1)

export interface MealPhoto {
  blobUrl: string
  note?: string | null
}

interface MealCardProps {
  meal: PlanMeal
  expanded: boolean
  onToggle: () => void
  /** Whether this meal has been logged as eaten (shows a checkmark badge). */
  eaten?: boolean
  /** Today's diary photos for this meal (rendered as a strip below the totals row). */
  photos?: MealPhoto[]
  /** When provided, renders a gold camera chip in the header that opens the
   *  meal-log-photo modal so the client can upload diary photos. */
  onPhotoPress?: () => void
}

function MealCard({ meal, expanded, onToggle, eaten, photos = [], onPhotoPress }: MealCardProps) {
  const { t } = useTranslation()
  const colors = useTheme()
  const kcal = meal.mealTotals?.kcal ?? 0
  const itemCount = totalMealItems(meal)

  const mealLabel = meal.kind ? t(`nutrition.mealKind.${meal.kind}`) : ''

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ visible: boolean; startIndex: number }>({
    visible: false,
    startIndex: 0,
  })
  const photoUrls = photos.map((p) => p.blobUrl).filter(Boolean)
  const photoNotes = photos.map((p) => p.note ?? null)

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
          <View style={styles.mealCardInfo}>
            <Text style={[styles.mealName, { color: colors.label }]}>
              {mealLabel}
            </Text>
            <Text style={[styles.mealMeta, { color: colors.label2 }]}>
              {meal.time ? `${meal.time} · ` : ''}
              {t('nutrition.items', { count: itemCount })}
            </Text>
          </View>
          {onPhotoPress && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.()
                onPhotoPress()
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('nutrition.addPhotoA11y')}
              style={[
                styles.cameraChip,
                {
                  backgroundColor: goldAlpha['12'],
                  borderColor: goldAlpha['35'],
                },
              ]}
            >
              <Ionicons name="camera" size={15} color={colors.onGoldChip} />
            </Pressable>
          )}
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
          {meal.foods?.map((food, idx) => (
            <FoodItemRow key={`f-${food.foodExternalId}-${idx}`} food={food} mealName={mealLabel} />
          ))}

          {/* Recipes */}
          {meal.recipes?.map((recipe, idx) => (
            <RecipeItemRow key={`r-${recipe.recipeId}-${idx}`} recipe={recipe} mealName={mealLabel} />
          ))}

          {/* Totals footer */}
          {meal.mealTotals && (
            <View style={[styles.mealTotalsFooter, { borderTopColor: colors.sep2 }]}>
              <Text style={[styles.mealTotalsLabel, { color: colors.label2 }]}>
                {t('nutrition.total')}
              </Text>
              <View style={styles.mealTotalsRight}>
                <Text style={[styles.mealKcal, { color: colors.label }]}>
                  {Math.round(kcal)} kcal
                </Text>
                <Text style={[styles.mealMacroSummary, { color: colors.label2 }]}>
                  <Text style={{ fontWeight: '600' }}>{t('nutrition.proteinShort')} {Math.round(meal.mealTotals?.protein ?? 0)}</Text>
                  <Text style={{ color: colors.label3 }}> · </Text>
                  <Text style={{ fontWeight: '600' }}>{t('nutrition.carbsShort')} {Math.round(meal.mealTotals?.carbs ?? 0)}</Text>
                  <Text style={{ color: colors.label3 }}> · </Text>
                  <Text style={{ fontWeight: '600' }}>{t('nutrition.fatShort')} {Math.round(meal.mealTotals?.fat ?? 0)}</Text>
                  <Text style={{ color: colors.label3 }}> · </Text>
                  <Text style={{ fontWeight: '600' }}>{t('nutrition.fiberShort')} {Math.round(meal.mealTotals?.fiber ?? 0)}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Photo strip — shown when the card has diary photos */}
          {photoUrls.length > 0 && (
            <View style={[styles.photoStrip, { borderTopColor: colors.sep2 }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoStripContent}
              >
                {photoUrls.map((url, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setLightbox({ visible: true, startIndex: idx })}
                    style={({ pressed }) => [pressed && { opacity: 0.75 }]}
                  >
                    <Image
                      source={{ uri: url }}
                      style={[styles.photoThumb, { borderRadius: Radius.sm }]}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

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

      {/* Lightbox — rendered outside the clipped accordion so it can cover full screen */}
      {photoUrls.length > 0 && (
        <ImageLightbox
          visible={lightbox.visible}
          images={photoUrls}
          startIndex={lightbox.startIndex}
          imageNotes={photoNotes}
          onClose={() => setLightbox({ visible: false, startIndex: 0 })}
        />
      )}
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
    (food.foodName ?? '')

  const categoryLabel = food.foodCategory
    ? t(`nutrition.foodCategory.${food.foodCategory}`, { defaultValue: food.foodCategory })
    : null
  const categoryColor = getFoodCategoryColor(food.foodCategory ?? undefined)

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
              <View style={styles.categoryChipWrap}>
                <View style={[styles.categoryChip, { backgroundColor: `${categoryColor}22` }]}>
                  <Text style={[styles.categoryChipText, { color: categoryColor }]} numberOfLines={1}>
                    {categoryLabel}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <View style={styles.foodRowRight}>
            <Text style={[styles.foodRowKcal, { color: colors.label }]}>
              {Math.round(kcal)} kcal
            </Text>
            <Text style={[styles.foodRowGrams, { color: colors.label3 }]}>
              {Math.round(food.amountGrams ?? 0)} g
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
            <View style={styles.categoryChipWrap}>
              <View style={[styles.categoryChip, { backgroundColor: `${RECIPE_CHIP_COLOR}22` }]}>
                <Text style={[styles.categoryChipText, { color: RECIPE_CHIP_COLOR }]} numberOfLines={1}>
                  {t('nutrition.recipe')}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.foodRowRight}>
            <Text style={[styles.foodRowKcal, { color: colors.label }]}>
              {Math.round(kcal)} kcal
            </Text>
            <Text style={[styles.foodRowGrams, { color: colors.label3 }]}>
              {t('nutrition.serving', { count: recipe.servings ?? 1 })}
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
    marginLeft: 4,
  },
  /**
   * Gold-tinted circular camera chip — mirrors CameraButton in MealRow.
   * 28×28, goldAlpha['12'] background, goldAlpha['35'] border, filled camera icon.
   */
  cameraChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  mealTotalsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    // Aligns the right column with the food row's kcal column:
    // food row has paddingHorizontal 16 + chevron (14) + marginLeft (2).
    paddingRight: 32,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mealTotalsLabel: {
    ...Type.footnote,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mealTotalsRight: {
    alignItems: 'flex-end',
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
  categoryChipWrap: {
    flexDirection: 'row',
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    maxWidth: '100%',
  },
  categoryChipText: {
    ...Type.caption2,
    fontWeight: '600',
    letterSpacing: 0.2,
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

  // Photo strip
  photoStrip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  photoStripContent: {
    gap: 6,
    flexDirection: 'row',
  },
  photoThumb: {
    width: 56,
    height: 56,
    overflow: 'hidden',
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
