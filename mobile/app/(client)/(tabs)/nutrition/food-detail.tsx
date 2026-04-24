import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Image,
  Animated,
  useColorScheme,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import type { MealFood } from '@/api/nutrition'
import { getFoodById } from '@/api/foods'
import type { FoodSummary } from '@/api/foods'
import i18n from '@/i18n'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLocalizedFoodName(food: MealFood): string {
  return (
    (i18n.language === 'cs' && food.foodNameCs) ||
    (i18n.language === 'de' && food.foodNameDe) ||
    (i18n.language === 'en' && food.foodNameEn) ||
    food.foodName
  ) as string
}

function computeNutrient(per100: number, grams: number): number {
  return (per100 * grams) / 100
}

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

// ─── Info Row ───────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string
  value: string
  isLast?: boolean
}) {
  const colors = useTheme()
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.label }]}>{label}</Text>
      <Text style={[styles.infoVal, { color: colors.label2 }]}>{value}</Text>
    </View>
  )
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function FoodDetailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const scheme = useColorScheme()
  const isDark = scheme === 'dark'
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ food: string; mealName: string; backLabel?: string }>()

  const food: MealFood | null = params.food ? JSON.parse(params.food) : null
  const mealName = params.mealName ?? ''
  const backLabel = params.backLabel ?? t('nutrition.plan')

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

  const [lightbox, setLightbox] = useState<{ visible: boolean; startIndex: number }>({
    visible: false,
    startIndex: 0,
  })

  // Fetch fresh food data from API
  const [freshFood, setFreshFood] = useState<FoodSummary | null>(null)

  useEffect(() => {
    if (!food?.foodExternalId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await getFoodById(food.foodExternalId ?? '')
        if (!cancelled) setFreshFood(data)
      } catch {
        // Silently fall back to snapshot data
      }
    })()
    return () => { cancelled = true }
  }, [food?.foodExternalId])

  if (!food) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <Text style={{ color: colors.label2 }}>No food data</Text>
        </View>
      </View>
    )
  }

  // Use fresh data when available, fall back to snapshot.
  // Generated types make nutrientValue / nutrientValuePer100Grams optional,
  // but they are always populated at runtime when a plan is loaded from the server.
  const foodName = freshFood?.name ?? getLocalizedFoodName(food)
  const n = freshFood
    ? freshFood.nutrientValue ?? food.nutrientValuePer100Grams
    : food.nutrientValuePer100Grams
  const grams = food.amountGrams ?? 0
  const foodNote = freshFood?.note ?? food.note ?? null

  // Computed values for the planned amount.
  // All nutrient fields are optional in the generated type but always populated at runtime.
  const kcal = computeNutrient(n?.kcal ?? 0, grams)
  const protein = computeNutrient(n?.protein ?? 0, grams)
  const carbs = computeNutrient(n?.carbs ?? 0, grams)
  const fat = computeNutrient(n?.fat ?? 0, grams)
  const fiber = computeNutrient(n?.fiber ?? 0, grams)
  const sugar = (n?.sugar != null) ? computeNutrient(n.sugar, grams) : null
  const saturatedFat = (n?.saturatedFat != null) ? computeNutrient(n.saturatedFat, grams) : null
  const salt = (n?.salt != null) ? computeNutrient(n.salt, grams) : null

  const resolvedCategory = (freshFood?.category ?? food.foodCategory) as string | undefined
  const categoryLabel = resolvedCategory
    ? t(`nutrition.foodCategory.${resolvedCategory}`, { defaultValue: resolvedCategory })
    : null

  // Max value for bar fill proportions (sum of all macros)
  const maxMacro = protein + carbs + fat + fiber || 1

  // When there's no hero image the header is always opaque — start at 1.
  // When there is an image it fades in from transparent as user scrolls.
  const hasImage = Boolean(freshFood?.imageUrl)
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
          <View style={[styles.headerIcon, { backgroundColor: colors.fill2 }]}>
            <Ionicons name="restaurant-outline" size={16} color={colors.label2} />
          </View>
          <Text style={[styles.headerName, { color: colors.label }]} numberOfLines={1}>
            {foodName}
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
        {/* Hero — image with overlaid title when imageUrl available, emoji fallback otherwise */}
        {freshFood?.imageUrl ? (
          <>
            <Pressable
              onPress={() => setLightbox({ visible: true, startIndex: 0 })}
              style={styles.heroImageWrapper}
              accessibilityRole="imagebutton"
            >
              <Image
                source={{ uri: freshFood.imageUrl }}
                style={[styles.heroImage, { backgroundColor: colors.fill2 }]}
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
                  { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.20)' },
                ]}>
                  <Ionicons name="restaurant-outline" size={18} color="white" />
                </View>
                <Text
                  style={styles.heroOverlayName}
                  numberOfLines={2}
                  onLayout={onHeroNameLayout}
                >
                  {foodName}
                </Text>
                <View style={styles.heroSub}>
                  {categoryLabel && (
                    <>
                      <View style={[
                        styles.overlayBadge,
                        { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)' },
                      ]}>
                        <Text style={styles.overlayBadgeText}>{categoryLabel}</Text>
                      </View>
                      <Text style={styles.overlayDot}>·</Text>
                    </>
                  )}
                  <Text style={styles.overlayGrams}>{Math.round(grams)} g</Text>
                </View>
              </View>
            </Pressable>
            <ImageLightbox
              visible={lightbox.visible}
              images={[freshFood.imageUrl]}
              startIndex={0}
              onClose={() => setLightbox(prev => ({ ...prev, visible: false }))}
            />
          </>
        ) : (
          // No-image fallback: centered emoji hero block.
          // Add top padding so content clears the absolute header.
          <View style={[styles.hero, { paddingTop: insets.top + HEADER_CONTENT_HEIGHT + 8 }]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.fill2 }]}>
              <Ionicons name="restaurant-outline" size={34} color={colors.label2} />
            </View>
            <Text style={[styles.heroName, { color: colors.label }]} onLayout={onHeroNameLayout}>{foodName}</Text>
            <View style={styles.heroSub}>
              {categoryLabel && (
                <>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.fill }]}>
                    <Text style={[styles.categoryBadgeText, { color: colors.label2 }]}>
                      {categoryLabel}
                    </Text>
                  </View>
                  <Text style={[styles.heroDot, { color: colors.label3 }]}>·</Text>
                </>
              )}
              <Text style={[styles.heroGrams, { color: colors.label2 }]}>
                {Math.round(grams)} g
              </Text>
            </View>
          </View>
        )}

        {/* Macros Card */}
        <View style={[styles.macrosCard, { backgroundColor: colors.bg2 }]}>
          <View style={styles.macrosHeader}>
            <Text style={[styles.macrosTitle, { color: colors.label }]}>
              {t('foodDetail.nutritionValues')}
            </Text>
            <Text style={[styles.kcalBadge, { color: colors.label }]}>
              {Math.round(kcal)}{' '}
              <Text style={[styles.kcalUnit, { color: colors.label2 }]}>kcal</Text>
            </Text>
          </View>

          <View style={styles.macroGrid}>
            <MacroGridItem
              label={t('foodDetail.protein')}
              value={protein}
              color={colors.macroProtein}
              maxValue={maxMacro}
              bgColor={colors.fill2}
            />
            <MacroGridItem
              label={t('foodDetail.carbs')}
              value={carbs}
              color={colors.macroCarbs}
              maxValue={maxMacro}
              bgColor={colors.fill2}
            />
            <MacroGridItem
              label={t('foodDetail.fat')}
              value={fat}
              color={colors.macroFat}
              maxValue={maxMacro}
              bgColor={colors.fill2}
            />
            <MacroGridItem
              label={t('foodDetail.fiber')}
              value={fiber}
              color={colors.macroFiber}
              maxValue={maxMacro}
              bgColor={colors.fill2}
            />
          </View>

        </View>

        {/* Note */}
        {foodNote ? (
          <View style={[styles.noteCard, { backgroundColor: colors.bg2 }]}>
            <View style={[styles.noteAccent, { backgroundColor: colors.gold }]} />
            <Text style={[styles.noteLabel, { color: colors.gold }]}>
              {t('foodDetail.trainerNote')}
            </Text>
            <Text style={[styles.noteText, { color: colors.label2 }]}>{foodNote}</Text>
          </View>
        ) : null}

        {/* Photos — single tile grid, shown only when imageUrl is available */}
        {freshFood?.imageUrl ? (() => {
          // 3-column layout: window width 340 approximation - 20px margins each side - 6px gaps between tiles
          // Formula mirrors recipe-detail: (340 - 6 * 2) / 3
          const TILE_SIZE = Math.floor((340 - 6 * 2) / 3)
          return (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.label3 }]}>
                {t('foodDetail.photos')}
              </Text>
              <View style={[styles.photosGrid, { backgroundColor: colors.bg2 }]}>
                <Pressable
                  onPress={() => setLightbox({ visible: true, startIndex: 0 })}
                  style={({ pressed }) => [
                    styles.photosTile,
                    { width: TILE_SIZE, height: TILE_SIZE, backgroundColor: colors.fill2 },
                    pressed && { opacity: 0.75 },
                  ]}
                  accessibilityRole="imagebutton"
                >
                  <Image
                    source={{ uri: freshFood.imageUrl }}
                    style={styles.photosTileImage}
                    resizeMode="cover"
                  />
                </Pressable>
              </View>
            </View>
          )
        })() : null}

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
    paddingHorizontal: 12,
    paddingVertical: 6,
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

  // Hero image wrapper — full-bleed, no margins/radius: extends edge-to-edge from the
  // very top of the scroll content so the absolute header floats over the photo.
  heroImageWrapper: {
    height: 180,
    overflow: 'hidden',
    position: 'relative',
  },

  // Hero image — fills the wrapper absolutely
  heroImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Dark gradient over the bottom portion of the image
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },

  // Overlaid title card at the bottom of the hero
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    gap: 4,
    alignItems: 'center',
  },
  heroOverlayIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  heroOverlayName: {
    ...Type.headline,
    color: 'white',
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
  },

  // Hero (no-image fallback)
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
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
  heroDot: { ...Type.footnote },
  heroGrams: { ...Type.footnote },
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
  overlayDot: { ...Type.footnote, color: 'rgba(255,255,255,0.7)' },
  overlayGrams: { ...Type.footnote, color: 'rgba(255,255,255,0.9)' },

  // Macros Card
  macrosCard: {
    marginHorizontal: 20,
    marginTop: 16,
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
    marginBottom: 12,
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

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: { ...Type.subheadline },
  infoVal: { ...Type.subheadline, fontWeight: '500' },

  // Photos grid
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

  // Note
  noteCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    paddingLeft: 14,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  noteAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
  },
  noteLabel: { ...Type.caption1, fontWeight: '600', marginBottom: 3 },
  noteText: { ...Type.footnote, lineHeight: 21 },
})
