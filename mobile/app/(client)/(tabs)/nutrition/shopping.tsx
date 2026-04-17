import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { createMMKV } from 'react-native-mmkv'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import i18n from '@/i18n'
import {
  getFullPlan,
  getRecipeDetail,
  type FullPlanWeek,
  type PlanDay,
  type MealFood,
} from '@/api/nutrition'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ─── Category colors (matching web food-category.ts) ───────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Fruit: '#c0392b',
  Vegetables: '#0f7b6c',
  Meat: '#8b5e3c',
  FishAndSeafood: '#0b6e99',
  Dairy: '#9b9a97',
  GrainsAndCereals: '#c9a84c',
  Legumes: '#6d8c54',
  NutsAndSeeds: '#ad5700',
  OilsAndFats: '#7a8b3c',
  SweetsAndSnacks: '#a0522d',
  Beverages: '#2e86ab',
  Supplements: '#6940a5',
  Other: '#9b9a97',
}

// ─── Types ──────────────────────────────────────────────────────────────

interface AggregatedFood {
  id: string
  name: string
  amount: number
  category: string
}

interface CategoryGroup {
  category: string
  categoryLabel: string
  items: AggregatedFood[]
}

// ─── Storage ────────────────────────────────────────────────────────────

const shoppingStorage = createMMKV({ id: 'shopping-checks' })

function getCheckedItems(weekKey: string): string[] {
  const raw = shoppingStorage.getString(`checked-${weekKey}`)
  return raw ? JSON.parse(raw) : []
}

function setCheckedItems(weekKey: string, ids: string[]): void {
  shoppingStorage.set(`checked-${weekKey}`, JSON.stringify(ids))
}

function getCollapsedCategories(weekKey: string, tab: number): string[] {
  const raw = shoppingStorage.getString(`collapsed-${weekKey}-t${tab}`)
  return raw ? JSON.parse(raw) : []
}

function setCollapsedCategories(weekKey: string, tab: number, cats: string[]): void {
  shoppingStorage.set(`collapsed-${weekKey}-t${tab}`, JSON.stringify(cats))
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatAmount(grams: number): string {
  const rounded = Math.round(grams)
  if (rounded >= 1000) return `${(rounded / 1000).toFixed(1)} kg`
  return `${rounded} g`
}

function getLocalizedFoodName(food: MealFood): string {
  return (
    (i18n.language === 'cs' && food.foodNameCs) ||
    (i18n.language === 'de' && food.foodNameDe) ||
    (i18n.language === 'en' && food.foodNameEn) ||
    food.foodName
  ) as string
}

function aggregateFoods(foods: { id: string; name: string; amount: number; category: string }[]): AggregatedFood[] {
  const map = new Map<string, AggregatedFood>()
  for (const f of foods) {
    const existing = map.get(f.id)
    if (existing) {
      existing.amount += f.amount
    } else {
      map.set(f.id, { ...f })
    }
  }
  return Array.from(map.values())
}

function groupByCategory(items: AggregatedFood[], t: (key: string, opts?: Record<string, string>) => string): CategoryGroup[] {
  const catMap = new Map<string, AggregatedFood[]>()
  for (const item of items) {
    const cat = item.category
    const arr = catMap.get(cat) ?? []
    arr.push(item)
    catMap.set(cat, arr)
  }

  const groups: CategoryGroup[] = []
  for (const [category, catItems] of catMap) {
    catItems.sort((a, b) => a.name.localeCompare(b.name))
    groups.push({
      category,
      categoryLabel: t(`nutrition.foodCategory.${category}`, { defaultValue: category }),
      items: catItems,
    })
  }

  groups.sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel))
  return groups
}

function buildHalf(
  days: PlanDay[],
  recipeFoods: Map<string, MealFood[]>,
  t: (key: string, opts?: Record<string, string>) => string,
): CategoryGroup[] {
  const rawFoods: { id: string; name: string; amount: number; category: string }[] = []

  for (const day of days) {
    for (const meal of (day.meals ?? [])) {
      for (const food of (meal.foods ?? [])) {
        rawFoods.push({
          id: food.foodExternalId ?? '',
          name: getLocalizedFoodName(food),
          amount: food.amountGrams ?? 0,
          category: food.foodCategory ?? 'Other',
        })
      }
      for (const recipe of meal.recipes ?? []) {
        const ingredients = recipeFoods.get(recipe.recipeId ?? '')
        if (!ingredients) continue
        for (const ing of ingredients) {
          rawFoods.push({
            id: ing.foodExternalId ?? '',
            name: getLocalizedFoodName(ing),
            amount: (ing.amountGrams ?? 0) * (recipe.servings ?? 1),
            category: ing.foodCategory ?? 'Other',
          })
        }
      }
    }
  }

  return groupByCategory(aggregateFoods(rawFoods), t)
}

// Row types for FlatList
type ListRow =
  | { type: 'categoryHeader'; label: string; category: string; itemCount: number; collapsed: boolean; key: string }
  | { type: 'item'; item: AggregatedFood; isLast: boolean; key: string }
  | { type: 'empty'; key: string }

function flattenGroups(groups: CategoryGroup[], collapsedSet: Set<string>): ListRow[] {
  if (groups.length === 0) return [{ type: 'empty', key: 'empty' }]
  const rows: ListRow[] = []
  for (const group of groups) {
    const collapsed = collapsedSet.has(group.category)
    rows.push({
      type: 'categoryHeader',
      label: group.categoryLabel,
      category: group.category,
      itemCount: group.items.length,
      collapsed,
      key: `cat-${group.category}`,
    })
    if (!collapsed) {
      group.items.forEach((item, idx) => {
        rows.push({ type: 'item', item, isLast: idx === group.items.length - 1, key: item.id })
      })
    }
  }
  return rows
}

// ─── Main Screen ────────────────────────────────────────────────────────

export default function ShoppingListScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const params = useLocalSearchParams<{ week?: string; from?: string }>()
  const week = params.week ? parseInt(params.week, 10) : 1
  const fromToday = params.from === 'today'
  const backLabel = fromToday ? t('tabs.today') : t('nutrition.plan')

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const weekKey = `w${week}`

  const [checkedIds, setCheckedIds] = useState<string[]>(() => getCheckedItems(weekKey))
  const [recipeFoods, setRecipeFoods] = useState<Map<string, MealFood[]>>(new Map())
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const [collapsedCats, setCollapsedCats] = useState<string[]>(() => getCollapsedCategories(weekKey, 0))

  // Tab animation
  const tabAnim = useRef(new Animated.Value(0)).current
  const [tabBarWidth, setTabBarWidth] = useState(0)

  const { data: plan, isLoading, isError } = useQuery({
    queryKey: ['nutrition', 'full-plan'],
    queryFn: getFullPlan,
    staleTime: 30_000,
  })

  const weekData: FullPlanWeek | null = useMemo(
    () => (plan?.weeks ?? []).find((w) => w.weekNumber === week) ?? null,
    [plan, week],
  )

  // Fetch recipe ingredients
  useEffect(() => {
    if (!weekData) return
    const recipeIds = new Set<string>()
    for (const day of (weekData.days ?? [])) {
      for (const meal of (day.meals ?? [])) {
        for (const recipe of meal.recipes ?? []) {
          if (recipe.recipeId) recipeIds.add(recipe.recipeId)
        }
      }
    }
    if (recipeIds.size === 0) {
      setRecipeFoods(new Map())
      return
    }

    let cancelled = false
    setRecipesLoading(true)
    ;(async () => {
      const results = await Promise.allSettled(
        Array.from(recipeIds).map((id) => getRecipeDetail(id)),
      )
      if (cancelled) return
      const map = new Map<string, MealFood[]>()
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.recipeId) {
          map.set(result.value.recipeId, result.value.foods ?? [])
        }
      }
      setRecipeFoods(map)
      setRecipesLoading(false)
    })()
    return () => { cancelled = true }
  }, [weekData])

  // Build the two halves
  const firstHalf = useMemo(() => {
    if (!weekData) return []
    const days = (weekData.days ?? []).filter((d) => (d.dayOfWeek ?? 0) >= 1 && (d.dayOfWeek ?? 0) <= 4)
    return buildHalf(days, recipeFoods, t)
  }, [weekData, recipeFoods, t])

  const secondHalf = useMemo(() => {
    if (!weekData) return []
    const days = (weekData.days ?? []).filter((d) => (d.dayOfWeek ?? 0) >= 5 && (d.dayOfWeek ?? 0) <= 7)
    return buildHalf(days, recipeFoods, t)
  }, [weekData, recipeFoods, t])

  const activeGroups = activeTab === 0 ? firstHalf : secondHalf
  const collapsedSet = useMemo(() => new Set(collapsedCats), [collapsedCats])
  const rows = useMemo(() => flattenGroups(activeGroups, collapsedSet), [activeGroups, collapsedSet])

  // Count items across both halves
  const allItemIds = useMemo(() => {
    const ids = new Set<string>()
    for (const group of [...firstHalf, ...secondHalf]) {
      for (const item of group.items) ids.add(item.id)
    }
    return ids
  }, [firstHalf, secondHalf])

  const totalCount = allItemIds.size

  const toggleItem = useCallback((foodId: string) => {
    setCheckedIds((prev) => {
      const next = prev.includes(foodId)
        ? prev.filter((id) => id !== foodId)
        : [...prev, foodId]
      setCheckedItems(weekKey, next)
      return next
    })
  }, [weekKey])

  const toggleCategory = useCallback((category: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setCollapsedCats((prev) => {
      const next = prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
      setCollapsedCategories(weekKey, activeTab, next)
      return next
    })
  }, [weekKey, activeTab])

  const handleTabChange = useCallback((tab: 0 | 1) => {
    if (tab === activeTab) return
    // Animate tab indicator
    Animated.spring(tabAnim, {
      toValue: tab,
      useNativeDriver: true,
      tension: 120,
      friction: 14,
    }).start()
    // Animate content change
    LayoutAnimation.configureNext({
      duration: 250,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    })
    setActiveTab(tab)
    // Restore collapsed state for new tab
    setCollapsedCats(getCollapsedCategories(weekKey, tab))
  }, [activeTab, weekKey, tabAnim])

  const checkedSet = useMemo(() => new Set(checkedIds), [checkedIds])

  const loading = isLoading || recipesLoading

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
          <ShoppingHeader week={week} onBack={handleBack} backLabel={backLabel} />
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.gold} />
            {recipesLoading && (
              <Text style={[styles.loadingHint, { color: colors.label3 }]}>
                {t('shopping.loadingIngredients')}
              </Text>
            )}
          </View>
        </SafeAreaView>
    )
  }

  // ── Error ──
  if (isError || !plan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
          <ShoppingHeader week={week} onBack={handleBack} backLabel={backLabel} />
          <View style={styles.centered}>
            <Ionicons name="cart-outline" size={48} color={colors.label3} />
            <Text style={[styles.emptyTitle, { color: colors.label2 }]}>
              {t('shopping.error')}
            </Text>
          </View>
        </SafeAreaView>
    )
  }

  // ── Empty (both halves) ──
  if (totalCount === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
          <ShoppingHeader week={week} onBack={handleBack} backLabel={backLabel} />
          <View style={styles.centered}>
            <Ionicons name="cart-outline" size={48} color={colors.label3} />
            <Text style={[styles.emptyTitle, { color: colors.label2 }]}>
              {t('shopping.empty')}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.label3 }]}>
              {t('shopping.emptyHint')}
            </Text>
          </View>
        </SafeAreaView>
    )
  }

  // ── List with tabs ──
  const tabs = [
    { label: t('shopping.monToThu'), count: firstHalf.reduce((s, g) => s + g.items.length, 0) },
    { label: t('shopping.friToSun'), count: secondHalf.reduce((s, g) => s + g.items.length, 0) },
  ]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ShoppingHeader week={week} onBack={handleBack} backLabel={backLabel} />

      {/* Week subtitle */}
      <View style={[styles.weekSubtitle, { borderBottomColor: colors.sep2 }]}>
        <Text style={[styles.weekSubtitleText, { color: colors.label2 }]}>
          {t('shopping.weekTitle', { week })}
        </Text>
      </View>

      {/* Tabs with animated indicator */}
      <View
        style={[styles.tabBar, { borderBottomColor: colors.sep2 }]}
        onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
      >
        {tabs.map((tab, idx) => {
          const isActive = activeTab === idx
          return (
            <Pressable
              key={idx}
              onPress={() => handleTabChange(idx as 0 | 1)}
              style={[styles.tab]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? colors.gold : colors.label3 },
                ]}
              >
                {tab.label}
              </Text>
              <View style={[styles.tabBadge, { backgroundColor: isActive ? colors.goldBg : colors.fill }]}>
                <Text style={[styles.tabBadgeText, { color: isActive ? colors.gold : colors.label3 }]}>
                  {tab.count}
                </Text>
              </View>
            </Pressable>
          )
        })}
        {/* Animated underline */}
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              backgroundColor: colors.gold,
              width: tabBarWidth / 2 || '50%',
              transform: [{
                translateX: tabAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, tabBarWidth / 2],
                }),
              }],
            },
          ]}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={({ item: row }) => {
          if (row.type === 'empty') {
            return (
              <View style={styles.emptyRow}>
                <Text style={[styles.emptyRowText, { color: colors.label3 }]}>
                  {t('shopping.noItems')}
                </Text>
              </View>
            )
          }
          if (row.type === 'categoryHeader') {
            const catColor = CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.Other
            return (
              <TouchableOpacity
                style={[styles.categoryHeader, { backgroundColor: colors.fill }]}
                onPress={() => toggleCategory(row.category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryLeft}>
                  <View style={[styles.categoryChip, { backgroundColor: catColor + '20' }]}>
                    <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                    <Text style={[styles.categoryChipText, { color: catColor }]}>
                      {row.label}
                    </Text>
                  </View>
                  <Text style={[styles.categoryCount, { color: colors.label3 }]}>
                    {row.itemCount}
                  </Text>
                </View>
                <Ionicons
                  name={row.collapsed ? 'chevron-forward' : 'chevron-down'}
                  size={16}
                  color={colors.label3}
                />
              </TouchableOpacity>
            )
          }
          const isChecked = checkedSet.has(row.item.id)
          return (
            <TouchableOpacity
              style={[
                styles.itemRow,
                !row.isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.sep2 },
              ]}
              onPress={() => toggleItem(row.item.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.sep },
                  isChecked && { backgroundColor: colors.gold, borderColor: colors.gold },
                ]}
              >
                {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <View style={styles.itemInfo}>
                <Text
                  style={[
                    styles.itemName,
                    { color: colors.label },
                    isChecked && styles.itemCheckedText,
                  ]}
                  numberOfLines={2}
                >
                  {row.item.name}
                </Text>
                <Text
                  style={[
                    styles.itemAmount,
                    { color: colors.label2 },
                    isChecked && styles.itemCheckedText,
                  ]}
                >
                  {formatAmount(row.item.amount)}
                </Text>
              </View>
            </TouchableOpacity>
          )
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  )
}

// ─── Header ─────────────────────────────────────────────────────────────

function ShoppingHeader({ week, onBack, backLabel }: { week: number; onBack: () => void; backLabel: string }) {
  const { t } = useTranslation()
  const colors = useTheme()

  return (
    <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
        <Ionicons name="chevron-back" size={28} color={colors.gold} />
        <Text style={[styles.backLabel, { color: colors.gold }]}>{backLabel}</Text>
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Ionicons name="cart-outline" size={18} color={colors.label} />
        <Text style={[styles.headerTitle, { color: colors.label }]} numberOfLines={1}>
          {t('shopping.title')}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  loadingHint: { ...Type.footnote, marginTop: 4 },

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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 8,
  },
  headerTitle: { ...Type.subheadline, fontWeight: '600' },
  headerSpacer: { width: 70 },

  // Week subtitle
  weekSubtitle: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekSubtitleText: {
    ...Type.footnote,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabText: {
    ...Type.footnote,
    fontWeight: '600',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    ...Type.caption2,
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
  },

  // Category headers
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryChipText: {
    ...Type.caption1,
    fontWeight: '600',
  },
  categoryCount: {
    ...Type.caption2,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingBottom: 40,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: { ...Type.subheadline, fontWeight: '500', flex: 1 },
  itemAmount: { ...Type.footnote, fontWeight: '600', marginLeft: 12, flexShrink: 0 },
  itemCheckedText: { opacity: 0.35, textDecorationLine: 'line-through' },

  // Empty states
  emptyTitle: { ...Type.subheadline, fontWeight: '600' },
  emptyHint: { ...Type.footnote, textAlign: 'center' },
  emptyRow: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyRowText: { ...Type.footnote, fontStyle: 'italic' },
})
