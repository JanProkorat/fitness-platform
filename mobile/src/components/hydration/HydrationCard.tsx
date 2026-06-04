/**
 * HydrationCard — compact Today-screen card for the hydration feature (#412).
 *
 * Shows: title, current/target progress, progress bar, and a gold circular
 * "+" button that opens HydrationQuickLogSheet.
 *
 * Only rendered when hydrationStore.enabled === true (caller gates this).
 */

import React, { useState, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { Type } from '@/constants/typography'
import { HydrationProgressBar } from './HydrationProgressBar'
import { HydrationQuickLogSheet } from './HydrationQuickLogSheet'
import { useHydrationStore, selectTodayTotalMl } from '@/stores/hydrationStore'

export function HydrationCard(): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()

  const log = useHydrationStore((s) => s.log)
  const targetMl = useHydrationStore((s) => s.targetMl)
  const addDrink = useHydrationStore((s) => s.addDrink)

  const todayTotal = selectTodayTotalMl(log)

  const [sheetVisible, setSheetVisible] = useState(false)

  const handleLog = useCallback(
    (amountMl: number) => {
      addDrink(amountMl)
      setSheetVisible(false)
    },
    [addDrink],
  )

  const styles = makeStyles(colors)

  return (
    <>
      <View
        style={[styles.card, { backgroundColor: colors.bg2 }]}
        accessibilityRole="none"
      >
        {/* Header row: title + current/target */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.label }]}>
            {t('hydration.card.title')}
          </Text>
          <Text style={[styles.progress, { color: colors.label2 }]}>
            {t('hydration.card.todayProgress', { current: todayTotal, target: targetMl })}
          </Text>
        </View>

        {/* Progress row: bar + add button */}
        <View style={styles.progressRow}>
          <View style={styles.barWrap}>
            <HydrationProgressBar currentMl={todayTotal} targetMl={targetMl} barHeight={8} />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => setSheetVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('hydration.card.addButtonA11y')}
          >
            <Ionicons name="add" size={22} color={colors.onAccent} />
          </Pressable>
        </View>
      </View>

      <HydrationQuickLogSheet
        visible={sheetVisible}
        onLog={handleLog}
        onDismiss={() => setSheetVisible(false)}
      />
    </>
  )
}

export default HydrationCard

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 16,
      borderRadius: Radius.lg,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...Type.headline,
      fontWeight: '700',
    },
    progress: {
      ...Type.footnote,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    barWrap: {
      flex: 1,
    },
    addBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  })
}
