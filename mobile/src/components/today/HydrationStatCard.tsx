/**
 * HydrationStatCard — compact stat-tile variant of the hydration tracker (#432).
 *
 * Occupies the middle slot of the Today stat strip when the hydration feature
 * is enabled (replaces the Plnění compliance StatCard in that slot).
 *
 * Visual shape mirrors StatCard exactly:
 *   - Short uppercase label ("Pití") in the top-left
 *   - Gold plus button in the top-right (24 px circle, like StatCard's headerIcon)
 *   - Big value: today's logged ml
 *   - Sub line: "z {target} ml"
 *   - Gold progress bar at the bottom (capped at 100%)
 *
 * Tapping anywhere on the card OR the plus button opens HydrationQuickLogSheet.
 * State is read from hydrationStore (Zustand reactive selectors) — no TanStack
 * Query needed (purely local MMKV-backed state).
 */

import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useHydrationStore, selectTodayTotalMl } from '@/stores/hydrationStore'
import { HydrationQuickLogSheet } from '@/components/hydration/HydrationQuickLogSheet'

export function HydrationStatCard(): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  // Reactive Zustand selectors — updates immediately when addDrink is called.
  const log = useHydrationStore((s) => s.log)
  const targetMl = useHydrationStore((s) => s.targetMl)
  const addDrink = useHydrationStore((s) => s.addDrink)

  const todayTotal = selectTodayTotalMl(log)

  const [sheetVisible, setSheetVisible] = useState(false)

  const openSheet = useCallback(() => setSheetVisible(true), [])

  const handleLog = useCallback(
    (amountMl: number) => {
      addDrink(amountMl)
      setSheetVisible(false)
    },
    [addDrink],
  )

  const progress = targetMl > 0 ? Math.min(todayTotal / targetMl, 1) : 0

  const styles = makeStyles(colors)

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.bg2, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={t('hydration.card.addButtonA11y')}
      >
        {/* Top row: label + gold plus */}
        <View style={styles.headerRow}>
          <Text style={[styles.label, { color: colors.label2 }]}>
            {t('today.hydration')}
          </Text>
          <Pressable
            hitSlop={8}
            onPress={openSheet}
            style={[styles.plusBtn, { backgroundColor: colors.gold }]}
            accessibilityRole="button"
            accessibilityLabel={t('hydration.card.addButtonA11y')}
          >
            <Ionicons name="add" size={13} color={colors.onAccent} />
          </Pressable>
        </View>

        {/* Value row */}
        <Text style={[styles.value, { color: colors.label }]}>
          {todayTotal}
        </Text>

        {/* Sub line */}
        <Text style={[styles.sub, { color: colors.label3 }]}>
          {t('today.hydrationSub', { target: targetMl })}
        </Text>

        {/* Gold progress bar */}
        <View style={[styles.track, { backgroundColor: colors.fill, marginTop: 6 }]}>
          <View
            style={[
              styles.fill,
              { width: `${progress * 100}%`, backgroundColor: colors.gold },
            ]}
          />
        </View>
      </Pressable>

      <HydrationQuickLogSheet
        visible={sheetVisible}
        onLog={handleLog}
        onDismiss={() => setSheetVisible(false)}
      />
    </>
  )
}

export default HydrationStatCard

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: Radius.md,
      padding: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    label: {
      ...Type.caption2,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    plusBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    value: {
      ...Type.title2,
    },
    sub: {
      ...Type.caption1,
      marginTop: 1,
    },
    track: {
      height: 4,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    fill: {
      height: 4,
      borderRadius: Radius.full,
    },
  })
}
