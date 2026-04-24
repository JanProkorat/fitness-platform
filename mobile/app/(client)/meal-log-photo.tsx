/**
 * Meal Log Photo screen — modal presented from the Today nutrition card.
 *
 * Prototype reference: docs/prototypes/mobile/scenes/meal-log-photo.html
 *
 * Layout:
 *   1. Minimal modal header (safe-area padding only — no close button, no subtitle)
 *   2. Meal header card: dot · name · time · kcal · item-count
 *   3. Ingredient list (compact rows, foods + recipes)
 *   4. Photo picker:
 *        - When 0 photos: dashed drop zone (tap = gallery multi-select,
 *          long-press = camera single-shot)
 *        - When ≥ 1: horizontal grid of square thumbnails + "add more" tile
 *   5. Note textarea (500-char counter)
 *   6. Info strip: visible-to-coach message
 *   7. Action bar (pinned): primary CTA only (full-width), dismiss via swipe-down
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useImagePicker } from '@/hooks/useImagePicker'
import { useAuthStore } from '@/stores/auth'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { getMealKindConfig } from '@/constants/mealKinds'
import {
  attachMealPhotos,
  generateMealPhotoUploadUrl,
  type TodayPlanResponse,
} from '@/api/nutrition'
import { Toast } from '@/lib/toast'

const NOTE_MAX_CHARS = 500

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function MealLogPhotoScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const queryClient = useQueryClient()

  // ── Route params ──
  const params = useLocalSearchParams<{
    mealId: string
    mealName: string
    mealTime: string
    mealKcal: string
    mealItemsCount: string
  }>()

  const mealId = params.mealId ?? ''
  const mealName = params.mealName ?? ''
  const mealTime = params.mealTime ?? ''
  const mealKcal = params.mealKcal ?? '0'
  const mealItemsCount = params.mealItemsCount ?? '0'

  // ── Coach name from auth store ──
  const coach = useAuthStore((s) => s.coach)
  const coachName = coach?.name ?? null

  // ── Meal data from cache (for ingredient rows) ──
  const plan = queryClient.getQueryData<TodayPlanResponse>(['today-plan'])
  const meal = useMemo(
    () => (plan?.meals ?? []).find((m) => m.mealId === mealId),
    [plan, mealId],
  )

  // ── Kind config for the accent dot ──
  const kindConfig = getMealKindConfig(meal?.kind)
  // Dark-mode detection: matches the dark bg token value from constants/colors.ts
  const isDark = colors.bg === '#1c1c1e'
  const dotColor = kindConfig.accent

  // ── Local state ──
  const [note, setNote] = useState('')
  const [uploadedBlobUrls, setUploadedBlobUrls] = useState<string[]>([])

  // ── Multi-photo picker (gallery) ──
  // onUploaded is undefined; we use onUploadedMany for multi-select results.
  const { pick: pickGallery, uploading: galleryUploading } = useImagePicker(
    {
      source: 'library',
      allowsMultipleSelection: true,
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        return generateMealPhotoUploadUrl(mealId, contentType, sizeBytes)
      },
    },
    undefined,
    (blobUrls) => {
      setUploadedBlobUrls((prev) => [...prev, ...blobUrls])
    },
  )

  // ── Single-shot camera picker ──
  const { pick: pickCamera, uploading: cameraUploading } = useImagePicker(
    {
      source: 'camera',
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        return generateMealPhotoUploadUrl(mealId, contentType, sizeBytes)
      },
    },
    (blobUrl) => {
      setUploadedBlobUrls((prev) => [...prev, blobUrl])
    },
  )

  const imageUploading = galleryUploading || cameraUploading

  // Drop zone: tap = gallery multi-select, long-press = camera
  const handleDropZoneTap = useCallback(() => {
    pickGallery()
  }, [pickGallery])

  const handleDropZoneLongPress = useCallback(() => {
    pickCamera()
  }, [pickCamera])

  // "Add more" tile inside the thumbnail grid — same behavior as drop zone
  const handleAddMore = useCallback(() => {
    pickGallery()
  }, [pickGallery])

  const handleRemovePhoto = useCallback((url: string) => {
    setUploadedBlobUrls((prev) => prev.filter((u) => u !== url))
  }, [])

  // ── Attach-photos mutation (photo-only, does NOT change eaten state) ──
  const attachMutation = useMutation({
    mutationFn: () =>
      attachMealPhotos(mealId, {
        photoBlobUrls: uploadedBlobUrls.length > 0 ? uploadedBlobUrls : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-log'] })
      queryClient.invalidateQueries({ queryKey: ['today-plan'] })
      Toast.show(t('mealLogPhoto.successToast'))
      router.back()
    },
  })

  // CTA disabled when: no photos uploaded AND note is empty/whitespace
  const hasContent = uploadedBlobUrls.length > 0 || note.trim().length > 0
  const isSubmitting = attachMutation.isPending
  const isLoading = isSubmitting || imageUploading

  const handleSubmit = useCallback(() => {
    if (isLoading || !hasContent) return
    attachMutation.mutate()
  }, [attachMutation, isLoading, hasContent])

  // ── Meta line for the meal header card ──
  const metaParts: string[] = []
  if (mealTime) metaParts.push(mealTime)
  if (mealKcal) metaParts.push(`${mealKcal} kcal`)
  const itemCount = parseInt(mealItemsCount, 10) || 0
  if (itemCount > 0) metaParts.push(t('nutrition.items', { count: itemCount }))
  const metaLine = metaParts.join(' · ')

  // ── Ingredient rows (foods + recipes from cached plan) ──
  const foods = meal?.foods ?? []
  const recipes = meal?.recipes ?? []
  const totalRows = foods.length + recipes.length

  // ── Info strip text ──
  const infoText = coachName
    ? t('mealLogPhoto.infoStrip', { coachName })
    : t('mealLogPhoto.infoStripNoCoach')

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Minimal header (safe-area spacing only — no close button, no subtitle) ── */}
        <View style={[styles.header, { borderBottomColor: colors.sep2 }]} />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Meal header card ── */}
          <View
            style={[
              styles.mealCard,
              { backgroundColor: colors.bg2 },
            ]}
          >
            <View style={[styles.mealDot, { backgroundColor: dotColor }]} />
            <View style={styles.mealCardInfo}>
              <Text style={[styles.mealCardName, { color: colors.label }]} numberOfLines={1}>
                {meal?.kind ? t(`nutrition.mealKind.${meal.kind}`) : mealName}
              </Text>
              {metaLine ? (
                <Text style={[styles.mealCardMeta, { color: colors.label2 }]} numberOfLines={1}>
                  {metaLine}
                </Text>
              ) : null}
            </View>
          </View>

          {/* ── Ingredient rows ── */}
          {totalRows > 0 && (
            <View
              style={[
                styles.ingredientList,
                { backgroundColor: colors.bg2 },
              ]}
            >
              {foods.map((food, idx) => {
                const factor = (food.amountGrams ?? 0) / 100
                const kcal = Math.round((food.nutrientValuePer100Grams?.kcal ?? 0) * factor)
                const isLast = idx === totalRows - 1
                return (
                  <View
                    key={`f-${food.foodExternalId ?? idx}`}
                    style={[
                      styles.ingredientRow,
                      !isLast && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.sep2,
                      },
                    ]}
                  >
                    <View style={styles.ingredientInfo}>
                      <Text
                        style={[styles.ingredientName, { color: colors.label }]}
                        numberOfLines={1}
                      >
                        {food.foodName}
                      </Text>
                      <Text
                        style={[styles.ingredientSub, { color: colors.label2 }]}
                        numberOfLines={1}
                      >
                        {Math.round(food.amountGrams ?? 0)} g
                      </Text>
                    </View>
                    <Text style={[styles.ingredientKcal, { color: colors.label }]}>
                      {kcal} kcal
                    </Text>
                  </View>
                )
              })}

              {recipes.map((recipe, idx) => {
                const foodIdx = foods.length + idx
                const isLast = foodIdx === totalRows - 1
                const kcal = Math.round(
                  (recipe.nutrientValuePerServing?.kcal ?? 0) * (recipe.servings ?? 1),
                )
                return (
                  <View
                    key={`r-${recipe.recipeId ?? idx}`}
                    style={[
                      styles.ingredientRow,
                      !isLast && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.sep2,
                      },
                    ]}
                  >
                    <View style={styles.ingredientInfo}>
                      <Text
                        style={[styles.ingredientName, { color: colors.label }]}
                        numberOfLines={1}
                      >
                        {recipe.recipeName}
                      </Text>
                      <Text
                        style={[styles.ingredientSub, { color: colors.label2 }]}
                        numberOfLines={1}
                      >
                        {t('nutrition.serving', { count: recipe.servings ?? 1 })}
                      </Text>
                    </View>
                    <Text style={[styles.ingredientKcal, { color: colors.label }]}>
                      {kcal} kcal
                    </Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* ── Photo picker ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.label2 }]}>
              {t('mealLogPhoto.photoSectionLabel').toUpperCase()}
            </Text>

            {uploadedBlobUrls.length === 0 ? (
              /* ── Empty state: dashed drop zone ── */
              <Pressable
                onPress={handleDropZoneTap}
                onLongPress={handleDropZoneLongPress}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={t('mealLogPhoto.photoPickerHint')}
                style={[
                  styles.photoDropZone,
                  {
                    backgroundColor: colors.bg2,
                    borderColor: colors.sep,
                  },
                ]}
              >
                {imageUploading ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <>
                    <Ionicons
                      name="camera-outline"
                      size={36}
                      color={colors.label3}
                      style={styles.dropZoneIcon}
                    />
                    <Text style={[styles.dropZoneHint, { color: colors.label2 }]}>
                      {t('mealLogPhoto.photoPickerHint')}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              /* ── Filled state: thumbnail grid ── */
              <View style={styles.thumbnailGrid}>
                {uploadedBlobUrls.map((url) => (
                  <View
                    key={url}
                    style={[styles.thumbnailCell, { backgroundColor: colors.fill2 }]}
                  >
                    <Image
                      source={{ uri: url }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => handleRemovePhoto(url)}
                      style={[styles.thumbnailRemoveBtn, { backgroundColor: colors.bg2 }]}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={12} color={colors.label2} />
                    </Pressable>
                  </View>
                ))}

                {/* "Add more" tile */}
                <Pressable
                  onPress={handleAddMore}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealLogPhoto.addMorePhotos')}
                  style={[
                    styles.thumbnailCell,
                    styles.addMoreTile,
                    {
                      backgroundColor: colors.bg2,
                      borderColor: colors.sep,
                    },
                  ]}
                >
                  {imageUploading ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <>
                      <Ionicons name="add" size={22} color={colors.label3} />
                      <Text style={[styles.addMoreLabel, { color: colors.label3 }]}>
                        {t('mealLogPhoto.addMorePhotos')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Note textarea ── */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, { color: colors.label2 }]}>
                {t('mealLogPhoto.noteSectionLabel').toUpperCase()}
              </Text>
              <Text style={[styles.noteCounter, { color: colors.label3 }]}>
                {t('mealLogPhoto.noteCounter', {
                  current: note.length,
                  max: NOTE_MAX_CHARS,
                })}
              </Text>
            </View>
            <TextInput
              value={note}
              onChangeText={(text) => setNote(text.slice(0, NOTE_MAX_CHARS))}
              placeholder={t('mealLogPhoto.notePlaceholder')}
              placeholderTextColor={colors.label3}
              multiline
              maxLength={NOTE_MAX_CHARS}
              style={[
                styles.noteInput,
                {
                  color: colors.label,
                  backgroundColor: colors.bg2,
                  borderColor: colors.sep2,
                },
              ]}
              textAlignVertical="top"
              accessibilityLabel={t('mealLogPhoto.noteSectionLabel')}
            />
          </View>

          {/* ── Info strip ── */}
          <View
            style={[
              styles.infoStrip,
              {
                backgroundColor: isDark
                  ? 'rgba(52,199,89,0.07)'
                  : 'rgba(52,199,89,0.06)',
                borderColor: 'rgba(52,199,89,0.22)',
              },
            ]}
          >
            <Text style={[styles.infoText, { color: colors.label2 }]}>
              {infoText}
            </Text>
          </View>

          {/* Bottom padding so the action bar doesn't cover content */}
          <View style={{ height: 8 }} />
        </ScrollView>

        {/* ── Action bar (single full-width primary CTA) ── */}
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: colors.bg,
              borderTopColor: colors.sep2,
            },
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={isLoading || !hasContent}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.gold,
                opacity: pressed || isLoading || !hasContent ? 0.5 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {t('mealLogPhoto.savePhoto')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

// Thumbnail grid: 3 columns with equal spacing. Each cell is a square whose
// side is (screenWidth - horizontal margins - gaps) / 3. We use flex-wrap
// instead of a fixed pixel value to stay responsive across device widths.
const GRID_COLUMNS = 3
const GRID_GAP = 8
const GRID_MARGIN = 20

// Approximate cell size — StyleSheet.create doesn't allow dynamic values; the
// actual layout relies on flex: 1/GRID_COLUMNS plus maxWidth to enforce square.
// We derive an absolute size constant only for the borderRadius computation.
const CELL_SIZE_APPROX = (375 - GRID_MARGIN * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Header — minimal, just provides the hairline separator below safe-area top
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Meal header card
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: GRID_MARGIN,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  mealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  mealCardInfo: { flex: 1, minWidth: 0 },
  mealCardName: { ...Type.callout, fontWeight: '600' },
  mealCardMeta: { ...Type.footnote, marginTop: 1 },

  // Ingredient list
  ingredientList: {
    marginHorizontal: GRID_MARGIN,
    marginTop: 10,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  ingredientInfo: { flex: 1, minWidth: 0 },
  ingredientName: { ...Type.subheadline, fontWeight: '500' },
  ingredientSub: { ...Type.caption1, marginTop: 1 },
  ingredientKcal: { ...Type.footnote, fontWeight: '600', flexShrink: 0 },

  // Section (photo + note)
  section: { marginHorizontal: GRID_MARGIN, marginTop: 20 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    ...Type.footnote,
    fontWeight: '600',
    letterSpacing: 0.05,
    marginBottom: 10,
  },

  // Photo drop zone (empty state)
  photoDropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 28,
  },
  dropZoneIcon: { marginBottom: 6 },
  dropZoneHint: { ...Type.footnote },

  // Thumbnail grid (filled state)
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  thumbnailCell: {
    // Each cell takes 1/GRID_COLUMNS of the available width minus gaps.
    // Using percentage-based flex would not enforce square; instead we set
    // width to the result of the layout calculation expressed as a percentage.
    // The `aspectRatio: 1` makes height match width automatically.
    width: `${(100 - (GRID_GAP * (GRID_COLUMNS - 1) / (375 - GRID_MARGIN * 2)) * 100) / GRID_COLUMNS}%`,
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailRemoveBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  // "Add more" tile
  addMoreTile: {
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    // Override overflow: hidden so the dashed border is visible on Android.
    overflow: 'visible',
    // Re-apply borderRadius without overflow clip (visual only).
    borderRadius: Radius.md,
  },
  addMoreLabel: {
    ...Type.caption2,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Note textarea
  noteCounter: { ...Type.caption1, marginBottom: 10 },
  noteInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
    ...Type.subheadline,
    lineHeight: 22,
  },

  // Info strip — green-tinted border box
  infoStrip: {
    marginHorizontal: GRID_MARGIN,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: { ...Type.footnote, lineHeight: 19 },

  // Action bar — single full-width primary CTA
  actionBar: {
    paddingHorizontal: GRID_MARGIN,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...Type.callout, fontWeight: '600' },
})

// Suppress unused variable lint for the approximation constant (used only in
// a comment to explain the borderRadius logic).
void CELL_SIZE_APPROX
