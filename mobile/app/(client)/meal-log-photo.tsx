/**
 * Meal Log Photo screen — modal presented from the Today nutrition card.
 *
 * Prototype reference: docs/prototypes/mobile/scenes/meal-log-photo.html
 *
 * Layout:
 *   1. Modal header: Close | meal-name · "mark as eaten" | spacer
 *   2. Meal header card: dot · name · time · kcal · item-count
 *   3. Ingredient list (compact rows, foods + recipes)
 *   4. Photo picker drop zone (dashed border, tap: gallery, long-press: camera)
 *   5. Note textarea (500-char counter)
 *   6. Info strip: visible-to-coach message
 *   7. Action bar (pinned): primary CTA + cancel
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
import { goldAlpha } from '@/constants/colors'
import { getMealKindConfig } from '@/constants/mealKinds'
import {
  logMealEaten,
  generateMealPhotoUploadUrl,
  type TodayPlanResponse,
  type TodayLogResponse,
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
  const isDark = colors.bg === '#1c1c1e'
  const dotColor = kindConfig.accent

  // ── Local state ──
  const [note, setNote] = useState('')
  const [uploadedBlobUrl, setUploadedBlobUrl] = useState<string | null>(null)

  // ── Image picker ──
  const { pick: pickImage, uploading: imageUploading } = useImagePicker(
    {
      source: 'both',
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        return generateMealPhotoUploadUrl({ contentType, sizeBytes })
      },
    },
    (blobUrl) => {
      setUploadedBlobUrl(blobUrl)
    },
  )

  const handleRemovePhoto = useCallback(() => {
    setUploadedBlobUrl(null)
  }, [])

  // ── Mutation ──
  const logMutation = useMutation({
    mutationFn: () =>
      logMealEaten(mealId, {
        photoBlobUrls: uploadedBlobUrl ? [uploadedBlobUrl] : undefined,
        note: note.trim() || undefined,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['today-log'] })
      const previous = queryClient.getQueryData<TodayLogResponse>(['today-log'])

      if (previous && meal) {
        const totals = {
          kcal: meal.mealTotals?.kcal ?? 0,
          protein: meal.mealTotals?.protein ?? 0,
          carbs: meal.mealTotals?.carbs ?? 0,
          fat: meal.mealTotals?.fat ?? 0,
          fiber: meal.mealTotals?.fiber ?? 0,
        }
        const newEntry = {
          mealId,
          mealName: meal.kind ?? '',
          eatenAt: new Date().toISOString(),
          totals,
          photos: uploadedBlobUrl
            ? [{ blobUrl: uploadedBlobUrl, uploadedAt: new Date().toISOString() }]
            : [],
          note: note.trim() || undefined,
        }
        const prevMealsEaten = previous.mealsEaten ?? []
        const prevConsumed = {
          kcal: previous.totalConsumed?.kcal ?? 0,
          protein: previous.totalConsumed?.protein ?? 0,
          carbs: previous.totalConsumed?.carbs ?? 0,
          fat: previous.totalConsumed?.fat ?? 0,
          fiber: previous.totalConsumed?.fiber ?? 0,
        }
        queryClient.setQueryData<TodayLogResponse>(['today-log'], {
          ...previous,
          mealsEaten: [...prevMealsEaten, newEntry],
          totalConsumed: {
            kcal: prevConsumed.kcal + totals.kcal,
            protein: prevConsumed.protein + totals.protein,
            carbs: prevConsumed.carbs + totals.carbs,
            fat: prevConsumed.fat + totals.fat,
            fiber: prevConsumed.fiber + totals.fiber,
          },
        })
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['today-log'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['today-plan'] })
      queryClient.invalidateQueries({ queryKey: ['today-log'] })
      queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    },
    onSuccess: () => {
      Toast.show(t('mealLogPhoto.successToast'))
      router.back()
    },
  })

  const handleSubmit = useCallback(() => {
    if (logMutation.isPending || imageUploading) return
    logMutation.mutate()
  }, [logMutation, imageUploading])

  const isSubmitting = logMutation.isPending
  const isLoading = isSubmitting || imageUploading

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
        {/* ── Modal header ── */}
        <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.closeBtn}
          >
            <Text style={[styles.closeText, { color: colors.label2 }]}>
              {t('mealLogPhoto.close')}
            </Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerTitle, { color: colors.label }]}
              numberOfLines={1}
            >
              {meal?.kind ? t(`nutrition.mealKind.${meal.kind}`) : mealName}
              {' · '}
              <Text style={{ color: colors.label2, fontWeight: '400' }}>
                {t('mealLogPhoto.headerSubtitle')}
              </Text>
            </Text>
          </View>

          {/* Spacer matching closeBtn width to keep title centered */}
          <View style={styles.closeBtn} />
        </View>

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

            {uploadedBlobUrl ? (
              /* Thumbnail with remove button */
              <View style={styles.thumbnailWrap}>
                <Image
                  source={{ uri: uploadedBlobUrl }}
                  style={[styles.thumbnail, { backgroundColor: colors.fill2 }]}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={handleRemovePhoto}
                  style={[styles.removeBtn, { backgroundColor: colors.bg2 }]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <Ionicons name="close" size={14} color={colors.label2} />
                </Pressable>
                <Pressable
                  onPress={pickImage}
                  style={[styles.thumbnailReplaceOverlay]}
                  accessibilityRole="button"
                  accessibilityLabel={t('mealLogPhoto.photoPickerReplaceHint')}
                >
                  <Text style={[styles.thumbnailReplaceHint, { color: colors.onAccent }]}>
                    {t('mealLogPhoto.photoPickerReplaceHint')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Dashed drop zone */
              <Pressable
                onPress={pickImage}
                onLongPress={pickImage}
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

        {/* ── Action bar ── */}
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
            disabled={isLoading}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.gold,
                opacity: pressed || isLoading ? 0.75 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {t('mealLogPhoto.markAsEaten')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.cancelBtn,
              {
                backgroundColor: colors.bg2,
                borderColor: colors.sep2,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[styles.cancelBtnText, { color: colors.label }]}>
              {t('mealLogPhoto.cancel')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { width: 56 },
  closeText: { ...Type.subheadline, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  headerTitle: { ...Type.subheadline, fontWeight: '600' },

  // Meal header card
  mealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
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
    marginHorizontal: 20,
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
  section: { marginHorizontal: 20, marginTop: 20 },
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

  // Photo drop zone
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

  // Thumbnail (uploaded photo)
  thumbnailWrap: {
    position: 'relative',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: 180,
    borderRadius: Radius.lg,
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  thumbnailReplaceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    borderRadius: Radius.lg,
  },
  thumbnailReplaceHint: {
    ...Type.caption1,
    fontWeight: '600',
    textAlign: 'center',
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
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: { ...Type.footnote, lineHeight: 19 },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    flex: 1,
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...Type.callout, fontWeight: '600' },
  cancelBtn: {
    paddingHorizontal: 18,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { ...Type.footnote, fontWeight: '600' },
})
