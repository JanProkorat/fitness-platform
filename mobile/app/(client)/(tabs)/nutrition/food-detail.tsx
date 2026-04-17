import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type LayoutChangeEvent,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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
  const params = useLocalSearchParams<{ food: string; mealName: string; backLabel?: string }>()

  const food: MealFood | null = params.food ? JSON.parse(params.food) : null
  const mealName = params.mealName ?? ''
  const backLabel = params.backLabel ?? t('nutrition.plan')

  // Track hero name visibility for header title
  const heroNameBottom = useRef(0)
  const headerTitleOpacity = useRef(new Animated.Value(0)).current
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
  }

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <Text style={{ color: colors.label2 }}>No food data</Text>
        </View>
      </SafeAreaView>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.gold} />
          <Text style={[styles.backLabel, { color: colors.gold }]}>{backLabel}</Text>
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
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={styles.hero}>
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

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  backLabel: { ...Type.body, marginLeft: -2 },
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

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 10,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
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
