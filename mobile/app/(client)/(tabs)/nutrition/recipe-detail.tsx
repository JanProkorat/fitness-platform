import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Image,
  Animated,
  useColorScheme,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams, useSegments } from 'expo-router'
import { hrefParams } from '@/lib/navigation'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { MealRecipe, RecipeDetail, MealFood } from '@/api/nutrition'
import { getRecipeDetail } from '@/api/nutrition'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

// ─── Macro Grid Item ────────────────────────────────────────────────────────

function MacroGridItem({
  label,
  value,
  color,
  maxValue,
  bgColor,
}: {
  label: string
  value: number
  color: string
  maxValue: number
  bgColor: string
}) {
  const colors = useTheme()
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0

  return (
    <View style={[styles.macroGridItem, { backgroundColor: bgColor }]}>
      <Text style={[styles.macroGridLabel, { color: colors.label3 }]}>{label}</Text>
      <Text style={[styles.macroGridVal, { color }]}>{value.toFixed(1)} g</Text>
      <View style={[styles.macroBar, { backgroundColor: colors.fill }]}>
        <View style={[styles.macroBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function RecipeDetailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { width: windowWidth } = useWindowDimensions()
  // 3-column grid inside section (marginHorizontal 20) + photosGrid (padding 10) with gap 6
  const TILE_SIZE = Math.floor((windowWidth - 40 - 20 - 6 * 2) / 3)
  const segments = useSegments()
  // Match MealCard's row logic: pick the nearest stack that contains the
  // target detail route so push uses the right slide animation.
  const segs = segments as string[]
  const basePath = segs.includes('plans')
    ? '/(client)/plans'
    : segs.includes('nutrition')
      ? '/(client)/nutrition'
      : '/(client)'
  const colors = useTheme()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ recipe: string; mealName: string; backLabel?: string }>()

  const mealRecipe: MealRecipe | null = params.recipe ? JSON.parse(params.recipe) : null
  const mealName = params.mealName ?? ''
  const backLabel = params.backLabel ?? t('nutrition.plan')

  const [detail, setDetail] = useState<RecipeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lightbox, setLightbox] = useState<{ visible: boolean; startIndex: number }>({
    visible: false,
    startIndex: 0,
  })

  // Track hero name visibility for header title
  const heroNameBottom = useRef(0)
  const headerTitleOpacity = useRef(new Animated.Value(0)).current
  // Drives header background: 0 = fully transparent (over hero), 1 = opaque (past hero)
  const headerBgProgress = useRef(new Animated.Value(0)).current
  const isHeaderVisible = useRef(false)

  const onHeroNameLayout = (e: LayoutChangeEvent) => {
    heroNameBottom.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollY = e.nativeEvent.contentOffset.y
    const shouldShow = scrollY > heroNameBottom.current
    if (shouldShow !== isHeaderVisible.current) {
      isHeaderVisible.current = shouldShow
      Animated.timing(headerTitleOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 150,
        useNativeDriver: true,
      }).start()
    }
    // Header bg fades in over the first 80 px of scroll (covers top portion of hero).
    // useNativeDriver:false required for backgroundColor interpolation.
    headerBgProgress.setValue(Math.min(scrollY / 80, 1))
  }

  useEffect(() => {
    if (!mealRecipe?.recipeId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const data = await getRecipeDetail(mealRecipe.recipeId ?? '')
        if (!cancelled) setDetail(data)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [mealRecipe?.recipeId])

  if (!mealRecipe) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <Text style={{ color: colors.label2 }}>No recipe data</Text>
        </View>
      </View>
    )
  }

  // Use full detail macros if loaded, otherwise fall back to summary data.
  // Generated types make all nutrient fields optional; guard with ?? 0.
  const servings = mealRecipe.servings ?? 1
  const perServing = mealRecipe.nutrientValuePerServing
  const n = detail?.totalNutrients ?? {
    kcal: (perServing?.kcal ?? 0) * servings,
    protein: (perServing?.protein ?? 0) * servings,
    carbs: (perServing?.carbs ?? 0) * servings,
    fat: (perServing?.fat ?? 0) * servings,
    fiber: (perServing?.fiber ?? 0) * servings,
  }

  const totalGrams = (n.protein ?? 0) + (n.carbs ?? 0) + (n.fat ?? 0) + (n.fiber ?? 0) || 1

  // When there's no hero image the header is always opaque — start at 1.
  // When there is an image it fades in from transparent as user scrolls.
  const hasImage = Boolean(detail?.imageUrl)
  const headerBgColor = hasImage
    ? headerBgProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(0,0,0,0)', colors.bg],
      })
    : colors.bg

  // Header height = safe-area top inset + 52 px content row
  const HEADER_CONTENT_HEIGHT = 52

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Absolute floating header — overlays the hero image */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top,
            backgroundColor: headerBgColor,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          {/* Translucent chip behind back button for legibility over bright photos */}
          <View style={[
            styles.backChip,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.40)' : 'rgba(0,0,0,0.22)' },
          ]}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
            <Text style={[styles.backChipLabel, { color: colors.gold }]}>{backLabel}</Text>
          </View>
        </TouchableOpacity>
        <Animated.View style={[styles.headerTitle, { opacity: headerTitleOpacity }]}>
          <View style={[styles.headerIcon, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
            <Ionicons name="book-outline" size={16} color={colors.blue} />
          </View>
          <Text style={[styles.headerName, { color: colors.label }]} numberOfLines={1}>
            {mealRecipe.recipeName}
          </Text>
        </Animated.View>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Hero image with overlaid title card — shown when imageUrl is available */}
        {(() => {
          // Build the combined image list used for both the lightbox and gallery indices
          const allImages = [
            detail?.imageUrl,
            ...(detail?.galleryImageUrls ?? []),
          ].filter((u): u is string => Boolean(u))

          if (!detail?.imageUrl) {
            // No-image fallback: centered emoji hero block.
            // Add top padding so content clears the absolute header.
            return (
              <View style={[styles.hero, { paddingTop: insets.top + HEADER_CONTENT_HEIGHT + 8 }]}>
                <View style={[styles.heroIcon, { backgroundColor: 'rgba(0,122,255,0.15)' }]}>
                  <Ionicons name="book-outline" size={44} color={colors.blue} />
                </View>
                <Text
                  style={[styles.heroName, { color: colors.label }]}
                  onLayout={onHeroNameLayout}
                >
                  {mealRecipe.recipeName}
                </Text>
                <View style={styles.heroSub}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.fill }]}>
                    <Text style={[styles.categoryBadgeText, { color: colors.label2 }]}>
                      {t('recipeDetail.recipe')}
                    </Text>
                  </View>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.fill }]}>
                    <Text style={[styles.categoryBadgeText, { color: colors.label2 }]}>
                      {t('nutrition.serving', { count: servings })}
                    </Text>
                  </View>
                  {detail?.prepTimeMinutes != null && (
                    <View style={[styles.categoryBadge, { backgroundColor: colors.fill }]}>
                      <Text style={[styles.categoryBadgeText, { color: colors.label2 }]}>
                        {t('recipeDetail.prepTime', { minutes: detail.prepTimeMinutes })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )
          }

          return (
            <>
              {/* Tappable hero image with gradient overlay + title card */}
              <Pressable
                onPress={() => setLightbox({ visible: true, startIndex: 0 })}
                style={styles.recipeHeroWrapper}
                accessibilityRole="imagebutton"
              >
                <Image
                  source={{ uri: detail.imageUrl }}
                  style={[styles.recipeHeroImage, { backgroundColor: colors.fill2 }]}
                  resizeMode="cover"
                />
                {/* Dark gradient at the bottom of the hero */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.65)']}
                  style={styles.heroGradient}
                  pointerEvents="none"
                />
                {/* Overlaid title card */}
                <View style={styles.heroOverlay} pointerEvents="none">
                  <View style={[
                    styles.heroOverlayIcon,
                    { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.35)' },
                  ]}>
                    <Ionicons name="book-outline" size={44} color="white" />
                  </View>
                  <Text
                    style={styles.heroOverlayName}
                    numberOfLines={2}
                    onLayout={onHeroNameLayout}
                  >
                    {mealRecipe.recipeName}
                  </Text>
                  <View style={styles.heroSub}>
                    <View style={[
                      styles.overlayBadge,
                      { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' },
                    ]}>
                      <Text style={styles.overlayBadgeText}>
                        {t('recipeDetail.recipe')}
                      </Text>
                    </View>
                    <View style={[
                      styles.overlayBadge,
                      { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' },
                    ]}>
                      <Text style={styles.overlayBadgeText}>
                        {t('nutrition.serving', { count: servings })}
                      </Text>
                    </View>
                    {detail.prepTimeMinutes != null && (
                      <View style={[
                        styles.overlayBadge,
                        { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' },
                      ]}>
                        <Text style={styles.overlayBadgeText}>
                          {t('recipeDetail.prepTime', { minutes: detail.prepTimeMinutes })}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>

              {/* Lightbox */}
              <ImageLightbox
                visible={lightbox.visible}
                images={allImages}
                startIndex={lightbox.startIndex}
                onClose={() => setLightbox(prev => ({ ...prev, visible: false }))}
              />
            </>
          )
        })()}

        {/* Description */}
        {detail?.description ? (
          <View style={[styles.descriptionCard, { backgroundColor: colors.bg2 }]}>
            <Text style={[styles.descriptionText, { color: colors.label2 }]}>
              {detail.description}
            </Text>
          </View>
        ) : null}

        {/* Trainer note */}
        {mealRecipe.note ? (
          <View style={[styles.noteCard, { backgroundColor: colors.bg2 }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.goldBg, borderRadius: Radius.md }]} />
            <Text style={[styles.noteText, { color: colors.label2 }]}>
              <Text style={{ fontWeight: '600', color: colors.gold }}>
                {t('recipeDetail.trainerNote')}{' '}
              </Text>
              {mealRecipe.note}
            </Text>
          </View>
        ) : null}

        {/* Total Macros Card */}
        <View style={[styles.macrosCard, { backgroundColor: colors.bg2 }]}>
          <View style={styles.macrosHeader}>
            <Text style={[styles.macrosTitle, { color: colors.label }]}>
              {t('recipeDetail.totalValues')}
            </Text>
            <Text style={[styles.kcalBadge, { color: colors.label }]}>
              {Math.round(n.kcal ?? 0)}{' '}
              <Text style={[styles.kcalUnit, { color: colors.label2 }]}>kcal</Text>
            </Text>
          </View>

          <View style={styles.macroGrid}>
            <MacroGridItem
              label={t('foodDetail.protein')}
              value={n.protein ?? 0}
              color={colors.macroProtein}
              maxValue={totalGrams}
              bgColor={colors.fill2}
            />
            <MacroGridItem
              label={t('foodDetail.carbs')}
              value={n.carbs ?? 0}
              color={colors.macroCarbs}
              maxValue={totalGrams}
              bgColor={colors.fill2}
            />
            <MacroGridItem
              label={t('foodDetail.fat')}
              value={n.fat ?? 0}
              color={colors.macroFat}
              maxValue={totalGrams}
              bgColor={colors.fill2}
            />
            <MacroGridItem
              label={t('foodDetail.fiber')}
              value={n.fiber ?? 0}
              color={colors.macroFiber}
              maxValue={totalGrams}
              bgColor={colors.fill2}
            />
          </View>
        </View>

        {/* Loading / Error states for detail */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.label3} />
            <Text style={[styles.loadingText, { color: colors.label3 }]}>
              {t('recipeDetail.loading')}
            </Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: colors.label3 }]}>
              {t('recipeDetail.error')}
            </Text>
          </View>
        )}

        {/* Ingredients — full food list from recipe detail */}
        {detail && (detail.foods?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label3 }]}>
              {t('recipeDetail.ingredients')}
            </Text>
            <View style={[styles.sectionList, { backgroundColor: colors.bg2 }]}>
              {(detail.foods ?? []).map((food: MealFood, idx: number) => {
                const kcal = Math.round((food.nutrientValuePer100Grams?.kcal ?? 0) * (food.amountGrams ?? 0) / 100)
                const isLast = idx === (detail.foods?.length ?? 0) - 1
                return (
                  <Pressable
                    key={`${food.foodExternalId}-${idx}`}
                    onPress={() => router.push(hrefParams(`${basePath}/food-detail`, { food: JSON.stringify(food), mealName: mealRecipe.recipeName ?? '', backLabel: mealRecipe.recipeName ?? '' }))}
                    style={({ pressed }) => pressed ? { opacity: 0.7 } : undefined}
                  >
                    <View
                      style={[
                        styles.ingredientRow,
                        !isLast && !food.note && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.sep2,
                        },
                      ]}
                    >
                      <Text style={[styles.ingredientName, { color: colors.label }]} numberOfLines={1}>
                        {food.foodName}
                      </Text>
                      <Text style={[styles.ingredientAmount, { color: colors.label2 }]}>
                        {Math.round(food.amountGrams ?? 0)} g
                      </Text>
                      <Text style={[styles.ingredientKcal, { color: colors.label3 }]}>
                        {kcal} kcal
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.label3} style={{ marginLeft: 2 }} />
                    </View>
                    {food.note ? (
                      <View style={[styles.ingredientNoteRow, !isLast && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.sep2,
                      }]}>
                        <Text style={[styles.ingredientNoteText, { color: colors.label3 }]}>
                          {food.note}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* Preparation steps */}
        {detail?.steps && detail.steps.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.label3 }]}>
              {t('recipeDetail.steps')}
            </Text>
            <View style={[styles.sectionList, { backgroundColor: colors.bg2 }]}>
              {detail.steps.map((step, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.stepRow,
                    idx < detail.steps!.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.sep2,
                    },
                  ]}
                >
                  <View style={[styles.stepNum, { backgroundColor: colors.goldBg }]}>
                    <Text style={[styles.stepNumText, { color: colors.gold }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.label2 }]}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Photos — gallery grid, rendered when hero OR gallery images exist */}
        {(() => {
          const allPhotos = [
            detail?.imageUrl,
            ...(detail?.galleryImageUrls ?? []),
          ].filter((u): u is string => Boolean(u))
          if (allPhotos.length === 0) return null
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.label3 }]}>
                {t('recipeDetail.photos')}
              </Text>
              <View style={[styles.photosGrid, { backgroundColor: colors.bg2 }]}>
                {allPhotos.map((uri, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() =>
                      setLightbox({ visible: true, startIndex: idx })
                    }
                    style={({ pressed }) => [
                      styles.photosTile,
                      { width: TILE_SIZE, height: TILE_SIZE, backgroundColor: colors.fill2 },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="imagebutton"
                  >
                    <Image
                      source={{ uri }}
                      style={styles.photosTileImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          )
        })()}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header — absolutely positioned, floats over the hero image
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  // Back button wraps its own chip — backBtn is just for hitSlop grouping
  backBtn: { flexShrink: 0 },
  // Translucent rounded chip behind the back button text/icon
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
  },
  backChipLabel: { ...Type.body, fontWeight: '600' },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerName: { ...Type.subheadline, fontWeight: '600', flexShrink: 1 },
  headerSpacer: { width: 70 },

  scrollContent: { paddingBottom: 20 },

  // Hero wrapper — full-bleed container for the image + gradient + overlay.
  // No margins/radius: extends edge-to-edge from the very top of the scroll content
  // so the absolute header floats over the top portion of the photo.
  recipeHeroWrapper: {
    height: 220,
    overflow: 'hidden',
    position: 'relative',
  },

  // Recipe hero image (fills the wrapper absolutely)
  recipeHeroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Dark gradient that sits on top of the image at the bottom half
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 130,
  },

  // Overlaid title card at the bottom of the hero image
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 5,
    alignItems: 'center',
  },
  heroOverlayIcon: {
    padding: 12,
    borderRadius: Radius.lg,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroOverlayName: {
    ...Type.title3,
    color: 'white',
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },

  // Photos grid (title lives above as a sectionTitle, same pattern as Ingredients/Steps)
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    padding: 10,
  },
  photosTile: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  photosTileImage: {
    width: '100%' as unknown as number,
    height: '100%' as unknown as number,
  },

  // Hero (no-image fallback)
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 10,
  },
  heroIcon: {
    padding: 12,
    borderRadius: Radius.lg,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { ...Type.title2, textAlign: 'center', lineHeight: 26 },
  heroSub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  categoryBadgeText: { ...Type.caption1, fontWeight: '600' },

  // Overlay chips / text — white translucent on photo
  overlayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  overlayBadgeText: { ...Type.caption1, fontWeight: '600', color: 'white' },
  // Macros Card
  macrosCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: Radius.lg,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  macrosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  macrosTitle: { ...Type.subheadline, fontWeight: '600' },
  kcalBadge: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  kcalUnit: { fontSize: 13, fontWeight: '400' },

  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  macroGridItem: {
    width: '47%' as unknown as number,
    borderRadius: Radius.sm,
    padding: 10,
    paddingHorizontal: 12,
  },
  macroGridLabel: {
    ...Type.caption2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  macroGridVal: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  macroBar: { height: 4, borderRadius: Radius.full, marginTop: 6, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: Radius.full },

  // Loading
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  loadingText: { ...Type.footnote },

  // Info sections
  section: { marginHorizontal: 20, marginBottom: 16 },
  sectionTitle: {
    ...Type.footnote,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionList: { borderRadius: Radius.sm, overflow: 'hidden' },

  // Ingredients
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ingredientName: { ...Type.subheadline, fontWeight: '500', flex: 1 },
  ingredientAmount: { ...Type.footnote, fontWeight: '500', flexShrink: 0 },
  ingredientKcal: { ...Type.caption1, flexShrink: 0, minWidth: 50, textAlign: 'right' },
  ingredientNoteRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 0,
    paddingLeft: 34,
  },
  ingredientNoteText: { ...Type.caption1, fontStyle: 'italic', lineHeight: 16 },

  // Preparation steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: { ...Type.caption1, fontWeight: '700' },
  stepText: { ...Type.subheadline, flex: 1, lineHeight: 22 },

  // Description card (below hero, above macros)
  descriptionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: Radius.sm,
    padding: 16,
    overflow: 'hidden',
  },
  descriptionText: { ...Type.subheadline, lineHeight: 22 },

  // Trainer note (matches plan day note style)
  noteCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  noteText: { ...Type.footnote, flex: 1, lineHeight: 20 },
})
