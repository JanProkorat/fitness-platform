import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { Type } from '@/constants/typography'
import { NutritionCardHero } from '@/components/nutrition/NutritionCardHero'
import { MealRow } from '@/components/nutrition/MealRow'
import { NoteBanner } from '@/components/ui/NoteBanner'
import { GoldButton } from '@/components/ui/GoldButton'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import type { NutrientTotals, PlanMeal } from '@/api/nutrition'

interface NutritionCardProps {
  consumed: NutrientTotals
  targets: {
    kcal: number
    protein: number
    carbs: number
    fat: number
    fiber: number
  }
  meals: PlanMeal[]
  eatenMealIds: Set<string>
  /** Eyebrow shown in the hero, e.g. "Výživa · Týden 4". */
  eyebrow: string
  /** Subline under the kcal headline, e.g. "3 jídla · 11 položek". */
  subline: string
  /** Daily note from the nutritionist. Rendered as a gold banner under the hero when present. */
  dayNote?: string | null
  /** Called when the user toggles a meal eaten/uneaten from the inline check button. */
  onToggleEaten?: (mealId: string) => void
  /**
   * Called when the user taps the gold camera button on a meal row.
   * Receives the mealId so the caller can navigate to the meal-log-photo screen.
   * Only shown on un-eaten meals (post-log state uses the photo indicator instead).
   */
  onPhotoPress?: (mealId: string) => void
  /**
   * Called when the user taps the "📷 Foto" header button.
   * Navigates to the plan-photos gallery screen.
   */
  onPhotoGridPress?: () => void
  /**
   * Set of meal IDs that already have at least one diary photo in the log.
   * Used to render the small photo indicator on eaten rows.
   */
  eatenMealIdsWithPhotos?: Set<string>
  /**
   * Called when the user taps the "mark whole day as eaten" CTA at the bottom
   * of the card. When omitted, the CTA is hidden. When every meal is already
   * eaten, the CTA is hidden automatically.
   */
  onMarkAllEaten?: () => void
  /** Show a spinner on the mark-all CTA while the mutation is in-flight. */
  isMarkAllLoading?: boolean
  /**
   * Per-meal diary photos from the log, keyed by mealId. Fed into MealRow so
   * the accordion body can display a horizontal thumbnail strip.
   * Each photo carries an optional per-photo caption (`note`).
   */
  mealPhotosByMealId?: Record<string, { blobUrl: string; note?: string | null; uploadedAt?: string }[]>
  /**
   * Meal-level diary note keyed by mealId. Passed to the lightbox as a top
   * overlay caption when the user opens photos for that meal.
   */
  mealNoteByMealId?: Record<string, string | null>
}

/**
 * Today-screen nutrition card. Training-card-style layout:
 *   1. Gold-brown `NutritionCardHero` with eyebrow / kcal / macro chips / meals-eaten ring
 *   2. Optional daily nutritionist note (`NoteBanner variant="day"`)
 *   3. Meal accordion list (one open at a time)
 *
 * Mirrors `docs/mobile_prototype.html` (`ph-today` scene, `grad-meal` card).
 */
export function NutritionCard({
  consumed,
  targets,
  meals,
  eatenMealIds,
  eyebrow,
  subline,
  dayNote,
  onToggleEaten,
  onPhotoPress,
  onPhotoGridPress,
  eatenMealIdsWithPhotos,
  onMarkAllEaten,
  isMarkAllLoading,
  mealPhotosByMealId,
  mealNoteByMealId,
}: NutritionCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [expandedMealIds, setExpandedMealIds] = useState<Set<string>>(
    () => new Set(),
  )
  const toggle = useCallback(
    (mealId: string) =>
      setExpandedMealIds((cur) => {
        const next = new Set(cur)
        if (next.has(mealId)) next.delete(mealId)
        else next.add(mealId)
        return next
      }),
    [],
  )

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* ── Card header row: title + Foto action button ── */}
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.label }]} numberOfLines={1}>
          {t('today.todaysNutrition')}
        </Text>
        {onPhotoGridPress ? (
          <Pressable
            onPress={onPhotoGridPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('nutrition.photoCta')}
            style={styles.photoCtaBtn}
          >
            <Ionicons name="camera-outline" size={15} color={colors.gold} />
            <Text style={[styles.photoCtaLabel, { color: colors.gold }]}>
              {t('nutrition.photoCta')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <NutritionCardHero
        eyebrow={eyebrow}
        consumedKcal={consumed.kcal ?? 0}
        targetKcal={targets.kcal}
        subline={subline}
        macros={{
          protein: { current: consumed.protein ?? 0, target: targets.protein },
          carbs: { current: consumed.carbs ?? 0, target: targets.carbs },
          fat: { current: consumed.fat ?? 0, target: targets.fat },
          fiber: { current: consumed.fiber ?? 0, target: targets.fiber },
        }}
        mealsEaten={eatenMealIds.size}
        mealsTotal={meals.length}
      />

      {dayNote ? (
        <NoteBanner variant="day" label={t('nutrition.dayNoteLabel')}>
          {dayNote}
        </NoteBanner>
      ) : null}

      {/* Meal list — inline accordion */}
      <View style={styles.meals}>
        {meals.map((meal, index) => (
          <MealRow
            key={meal.mealId ?? index}
            meal={meal}
            eaten={meal.mealId ? eatenMealIds.has(meal.mealId) : false}
            isLast={index === meals.length - 1}
            expanded={meal.mealId ? expandedMealIds.has(meal.mealId) : false}
            onToggle={() => meal.mealId && toggle(meal.mealId)}
            onToggleEaten={
              onToggleEaten && meal.mealId ? () => onToggleEaten(meal.mealId!) : undefined
            }
            onPhotoPress={
              onPhotoPress && meal.mealId ? () => onPhotoPress(meal.mealId!) : undefined
            }
            hasPhotos={meal.mealId ? (eatenMealIdsWithPhotos?.has(meal.mealId) ?? false) : false}
            photos={meal.mealId ? (mealPhotosByMealId?.[meal.mealId] ?? []) : []}
            mealNote={meal.mealId ? (mealNoteByMealId?.[meal.mealId] ?? null) : null}
          />
        ))}
      </View>

      {/* Mark whole day as eaten — hidden when every meal is already logged */}
      {onMarkAllEaten && eatenMealIds.size < meals.length && meals.length > 0 ? (
        <View style={styles.ctaWrap}>
          <GoldButton
            title={t('today.markAllEaten')}
            onPress={onMarkAllEaten}
            loading={isMarkAllLoading}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginHorizontal: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardTitle: {
    ...Type.title3,
    flex: 1,
    minWidth: 0,
  },
  photoCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    flexShrink: 0,
  },
  photoCtaLabel: {
    ...Type.subheadline,
    fontWeight: '600',
  },
  meals: {
    paddingHorizontal: 16,
  },
  ctaWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
})

export default NutritionCard
