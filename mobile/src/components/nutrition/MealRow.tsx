import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { getMealKindConfig } from '@/constants/mealKinds'
import { totalMealItems } from '@/lib/nutrition-plan-helpers'
import { FoodItemRow, RecipeItemRow } from '@/components/nutrition/MealCard'
import { MealReminderRow } from '@/components/nutrition/MealReminderRow'
import { NoteBanner } from '@/components/ui/NoteBanner'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import type { PlanMeal } from '@/api/nutrition'
import type { ColorScheme } from '@/constants/colors'
import { goldAlpha } from '@/constants/colors'

const ANIM_DURATION = 250
const ANIM_EASING = Easing.bezier(0.25, 0.1, 0.25, 1)

interface MealRowProps {
  meal: PlanMeal
  eaten?: boolean
  /** Hides bottom border on the final row */
  isLast?: boolean
  /** Controlled expand state — pass together with `onToggle` for accordion behavior. When omitted, the row stays collapsed and behaves like a plain list row. */
  expanded?: boolean
  onToggle?: () => void
  /** Non-expand tap — used by the plans page where tapping the row should navigate or do nothing. Ignored when `onToggle` is provided. */
  onPress?: () => void
  /**
   * Tap handler for the leading check button. When provided, a visible
   * circular checkbox replaces the old long-press-to-mark gesture — mirrors
   * `ex-ios-done` from the prototype. Propagation is isolated so tapping the
   * check does not also toggle the accordion.
   */
  onToggleEaten?: () => void
  /**
   * Tap handler for the gold camera button. When provided, a 28×28 gold-tinted
   * circular camera icon button is shown before the check button (accordion mode
   * only) — visible regardless of eaten state so clients can attach diary
   * photos retroactively.
   *
   * Mirrors the prototype `docs/prototypes/mobile/scenes/today.html` lines 452/473/493.
   */
  onPhotoPress?: () => void
  /**
   * When true, shows a small photo thumbnail indicator on the row to signal
   * that at least one diary photo exists for this meal log entry.
   */
  hasPhotos?: boolean
  /**
   * Diary photos for this meal's log entry. When `hasPhotos` is true and the
   * user taps the gold camera indicator badge, these are opened in ImageLightbox.
   * Each photo carries an optional per-photo caption (`note`).
   */
  photos?: { blobUrl: string; note?: string | null; uploadedAt?: string }[]
  /**
   * Meal-level diary note. When non-empty, shown as a top overlay caption in
   * the lightbox when photos are opened.
   */
  mealNote?: string | null
  /**
   * Plan id used to namespace the MMKV reminder key — `meal-<planId>-<mealId>`.
   * When provided in accordion mode, a `MealReminderRow` is mounted in the
   * expanded body so the Today screen surfaces the same reminder toggle as the
   * plan-detail screen. Omit for read-only (plans-page) usage where reminders
   * are managed on the plan-detail screen directly.
   */
  planId?: string
  /**
   * Localized day label (e.g. "Pondělí") passed through to MealReminderRow
   * for the push-notification body. Pass empty string to omit the day part.
   * Defaults to '' when omitted.
   */
  dayLabel?: string
}

/**
 * Compact meal row. Two visual modes:
 *
 *  - **Accordion mode** (Today card, when `onToggle` is provided): matches the
 *    prototype's `ex-ios-row` pattern — a small colored dot, title + compact
 *    meta line (`time · kcal · N items`), circular check button, chevron. The
 *    body reveals `FoodItemRow` / `RecipeItemRow` plus a meal-level note
 *    banner when `expanded`.
 *
 *  - **Read-only mode** (plans page, no `onToggle`): keeps the richer
 *    header with the kind emoji square + per-meal kcal/macro stack on the
 *    right, for the weekly plan overview context.
 */
export const MealRow = React.memo(function MealRow({
  meal,
  eaten,
  isLast,
  expanded,
  onToggle,
  onPress,
  onToggleEaten,
  onPhotoPress,
  hasPhotos,
  photos,
  mealNote,
  planId,
  dayLabel = '',
}: MealRowProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // Lightbox state — opened by tapping the gold photo-indicator badge on the row header
  const [lightboxVisible, setLightboxVisible] = useState(false)

  const photoList = photos ?? []
  const photoUrls = photoList.map((p) => p.blobUrl).filter(Boolean)
  const photoNotes = photoList.map((p) => p.note ?? null)

  const handleBadgePress = useCallback(() => {
    if (photoUrls.length > 0) setLightboxVisible(true)
  }, [photoUrls.length])

  const handleLightboxClose = useCallback(() => {
    setLightboxVisible(false)
  }, [])

  const kindConfig = getMealKindConfig(meal.kind)
  const isDark = colors.isDark
  const tint = isDark ? kindConfig.tintDark : kindConfig.tintLight

  const title = meal.kind ? t(`nutrition.mealKind.${meal.kind}`) : ''
  const itemCount = totalMealItems(meal)
  const kcal = meal.mealTotals?.kcal ?? 0
  const totals = meal.mealTotals

  const handlePress = onToggle ?? onPress
  const isExpandable = !!onToggle

  // Animated accordion body (only used in expandable mode). Body content is
  // always rendered for height measurement; the wrapper clips height via
  // `useSharedValue` + `withTiming`. Mirrors MealCard's pattern.
  const contentHeight = useSharedValue(0)
  const measuredHeight = useRef(0)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!isExpandable) return
    if (isFirstRender.current) {
      isFirstRender.current = false
      contentHeight.value = expanded ? measuredHeight.current || 0 : 0
      return
    }
    contentHeight.value = withTiming(
      expanded ? measuredHeight.current : 0,
      { duration: ANIM_DURATION, easing: ANIM_EASING },
    )
  }, [expanded, isExpandable, contentHeight])

  const animatedBodyStyle = useAnimatedStyle(() => ({
    height: contentHeight.value,
  }))

  const handleBodyLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height
      if (h > 0 && h !== measuredHeight.current) {
        measuredHeight.current = h
        // Use withTiming so a re-layout during expansion (e.g. from a
        // NoteBanner border) doesn't cancel the running open animation.
        if (expanded)
          contentHeight.value = withTiming(h, { duration: ANIM_DURATION, easing: ANIM_EASING })
      }
    },
    [expanded, contentHeight],
  )

  // Meta line: in accordion mode we pack `time · kcal · N items` into the
  // subtitle (ex-ios-row shape). In read-only mode we keep the plain
  // `time · N items` and let the right column carry kcal/macros.
  const metaParts: string[] = []
  if (meal.time) metaParts.push(meal.time)
  if (isExpandable) metaParts.push(`${Math.round(kcal)} kcal`)
  metaParts.push(t('nutrition.items', { count: itemCount }))
  const metaLine = metaParts.join(' · ')

  return (
    <View>
      <Pressable
        onPress={handlePress}
        style={[
          styles.row,
          isExpandable ? styles.rowAccordion : styles.rowReadOnly,
          {
            borderBottomColor: colors.sep2,
            // Hide bottom border when this row is expanded (body has its own
            // top border) or when it's the last collapsed row.
            borderBottomWidth:
              (isLast && !expanded) || expanded ? 0 : StyleSheet.hairlineWidth,
            // Tint the header strip with the meal-kind palette when expanded so
            // the header reads as the section's title surface, not just another
            // row. Collapsed rows stay neutral to keep the list quiet.
            // The negative horizontal margin + matching inner padding lets the
            // tint extend edge-to-edge inside the parent NutritionCard (which
            // pads its meal list by 16) so the strip aligns with the
            // edge-to-edge expanded body below it.
            backgroundColor: isExpandable && expanded ? tint : 'transparent',
            marginHorizontal: isExpandable && expanded ? -16 : 0,
            paddingHorizontal: isExpandable && expanded ? 16 : 0,
          },
        ]}
      >
        {isExpandable ? (
          <View style={[styles.accentBar, { backgroundColor: kindConfig.accent }]} />
        ) : (
          <View style={[styles.icon, { backgroundColor: tint }]}>
            <Text style={styles.iconText}>{kindConfig.icon}</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text
            style={[
              styles.name,
              isExpandable && styles.nameAccordion,
              { color: colors.label },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[styles.meta, { color: colors.label2 }]} numberOfLines={1}>
            {metaLine}
          </Text>
        </View>

        {!isExpandable && (
          <View style={styles.right}>
            <Text style={[styles.kcal, { color: colors.label }]}>
              {Math.round(kcal)} kcal
            </Text>
            {totals && (
              <Text style={styles.macros} numberOfLines={1}>
                <Text style={{ color: colors.macroProtein, fontWeight: '600' }}>
                  {t('nutrition.proteinShort')} {Math.round(totals.protein ?? 0)}
                </Text>
                <Text style={{ color: colors.label3 }}> · </Text>
                <Text style={{ color: colors.macroCarbs, fontWeight: '600' }}>
                  {t('nutrition.carbsShort')} {Math.round(totals.carbs ?? 0)}
                </Text>
                <Text style={{ color: colors.label3 }}> · </Text>
                <Text style={{ color: colors.macroFat, fontWeight: '600' }}>
                  {t('nutrition.fatShort')} {Math.round(totals.fat ?? 0)}
                </Text>
                <Text style={{ color: colors.label3 }}> · </Text>
                <Text style={{ color: colors.macroFiber, fontWeight: '600' }}>
                  {t('nutrition.fiberShort')} {Math.round(totals.fiber ?? 0)}
                </Text>
              </Text>
            )}
          </View>
        )}

        {/* Photo indicator — tappable badge that opens the lightbox */}
        {isExpandable && hasPhotos && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.()
              handleBadgePress()
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('mealLogPhoto.openPhotosA11y')}
            style={[styles.photoIndicator, { backgroundColor: colors.goldBg }]}
          >
            <Ionicons name="camera" size={11} color={colors.gold} />
          </Pressable>
        )}

        {/* Gold camera button — always visible in accordion mode so clients can
            attach diary photos both pre- and post-eaten. */}
        {isExpandable && onPhotoPress && (
          <CameraButton onPress={onPhotoPress} colors={colors} />
        )}

        {onToggleEaten && (
          <CheckButton eaten={!!eaten} onPress={onToggleEaten} />
        )}

        {isExpandable ? (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.label3}
            style={styles.trailing}
          />
        ) : eaten && !onToggleEaten ? (
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={colors.green}
            style={styles.trailing}
          />
        ) : (
          <Text style={[styles.chev, { color: colors.label3 }]}>›</Text>
        )}
      </Pressable>

      {isExpandable && (
        <>
          <ImageLightbox
            visible={lightboxVisible}
            images={photoUrls}
            startIndex={0}
            onClose={handleLightboxClose}
            mealNote={mealNote}
            imageNotes={photoNotes}
          />
          <Animated.View style={[styles.bodyClip, animatedBodyStyle]}>
            <View
              onLayout={handleBodyLayout}
              style={[
                styles.body,
                styles.bodyAbsolute,
                {
                  borderTopColor: colors.sep2,
                  borderBottomColor: colors.sep2,
                  borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              {/* Meal plan note — trainer's note from the plan. Tinted with
                  the meal-kind palette + accent bar so it reads as an
                  extension of the section header above instead of a
                  competing gold band. */}
              {meal.note ? (
                <NoteBanner
                  variant="meal"
                  label={t('nutrition.mealNoteLabel')}
                  tint={tint}
                  accentColor={kindConfig.accent}
                >
                  {meal.note}
                </NoteBanner>
              ) : null}
              {(meal.foods ?? []).map((food, idx) => (
                <FoodItemRow
                  key={`f-${food.foodExternalId}-${idx}`}
                  food={food}
                  mealName={title}
                />
              ))}
              {meal.recipes?.map((recipe, idx) => (
                <RecipeItemRow
                  key={`r-${recipe.recipeId}-${idx}`}
                  recipe={recipe}
                  mealName={title}
                />
              ))}
              {/* Reminder toggle — mounted inside the measured body so its
                  height is counted toward the accordion expand measurement.
                  Only rendered in accordion mode when a planId is provided
                  (Today screen). Reuses the exact same MMKV key as
                  plan-detail (meal-<planId>-<mealId>) for cross-surface
                  parity. */}
              {isExpandable && planId != null ? (
                <MealReminderRow meal={meal} planId={planId} dayLabel={dayLabel} />
              ) : null}
            </View>
          </Animated.View>
        </>
      )}
    </View>
  )
})

interface CheckButtonProps {
  eaten: boolean
  onPress: () => void
}

/**
 * Circular check button (mirrors `ex-ios-done` in the prototype). 24×24,
 * outlined when unchecked and filled-gold with a white check when checked.
 * `Pressable` captures the tap so it does not bubble to the parent row's
 * accordion toggle.
 */
function CheckButton({ eaten, onPress }: CheckButtonProps) {
  const colors = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: eaten }}
      style={[
        styles.check,
        {
          backgroundColor: eaten ? colors.green : 'transparent',
          borderColor: eaten ? colors.green : colors.sep,
        },
      ]}
    >
      {eaten && <Ionicons name="checkmark" size={14} color={colors.onAccent} />}
    </Pressable>
  )
}

/**
 * Gold-tinted circular camera button. 28×28, matching the prototype spec
 * (docs/prototypes/mobile/scenes/today.html lines 452/473/493).
 *
 * Uses `goldAlpha['12']` as background and `goldAlpha['35']` as border — both
 * come from the design-token constants, not hardcoded hex.
 *
 * The `colors` prop is passed in (not obtained via hook) so this component
 * can remain a plain function without registering its own hook call, keeping
 * MealRow's hook-call count stable.
 */
function CameraButton({ onPress, colors }: { onPress: () => void; colors: ColorScheme }) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation?.()
        onPress()
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Add meal photo"
      style={[
        styles.cameraBtn,
        {
          backgroundColor: goldAlpha['12'],
          borderColor: goldAlpha['35'],
        },
      ]}
    >
      <Ionicons name="camera" size={15} color={colors.onGoldChip} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowAccordion: {
    paddingVertical: 14,
    gap: 12,
  },
  rowReadOnly: {
    paddingVertical: 12,
  },
  /**
   * Vertical accent bar at the left of the accordion header — replaces the
   * tiny dot and gives the meal-kind color enough visual weight to anchor
   * the section title.
   */
  accentBar: {
    width: 4,
    height: 32,
    borderRadius: 2,
    flexShrink: 0,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...Type.body,
    fontWeight: '600',
  },
  /**
   * Accordion-mode title gets a heavier weight + tighter tracking so it
   * reads as a section heading instead of yet another list-row label.
   */
  nameAccordion: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: {
    ...Type.caption1,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  kcal: {
    ...Type.footnote,
    fontWeight: '600',
  },
  macros: {
    ...Type.caption2,
    marginTop: 2,
  },
  trailing: {
    marginLeft: 8,
  },
  chev: {
    fontSize: 18,
    lineHeight: 18,
    marginLeft: 8,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  /**
   * Gold-tinted circular camera button (prototype lines 452/473/493).
   * 28×28 to match the prototype spec exactly.
   */
  cameraBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  /** Small badge shown on eaten rows that already have diary photos */
  photoIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bodyClip: {
    overflow: 'hidden',
    // Negative horizontal margin cancels the NutritionCard's 16px inner
    // padding so the food/recipe rows span edge-to-edge like in MealCard.
    marginHorizontal: -16,
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bodyAbsolute: {
    // Positioned at top so the clipping wrapper reveals from top down.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
})

export default MealRow
