/**
 * HydrationCard — Today-screen card for the drinking regime feature (#334).
 *
 * Shows current intake / target, a compact progress bar, and a primary
 * "+250 ml" button. Tapping the card body navigates to /hydration.
 */

import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { Type } from '@/constants/typography'
import { HydrationProgressBar } from './HydrationProgressBar'
import { useHydrationStore, selectTodayTotalMl } from '@/stores/hydrationStore'

export function HydrationCard(): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()
  const router = useRouter()

  const log = useHydrationStore((s) => s.log)
  const targetMl = useHydrationStore((s) => s.targetMl)
  const addDrink = useHydrationStore((s) => s.addDrink)

  const todayTotal = selectTodayTotalMl(log)

  const handleCardPress = useCallback(() => {
    router.push('/(client)/(tabs)/hydration' as never)
  }, [router])

  const handleQuickAdd = useCallback(() => {
    addDrink(250)
  }, [addDrink])

  const styles = makeStyles(colors)

  return (
    <Pressable
      onPress={handleCardPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.bg2, opacity: pressed ? 0.92 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('hydration.card.title')}
    >
      {/* Header row */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.label }]}>
          {t('hydration.card.title')}
        </Text>
        <Text style={[styles.progress, { color: colors.label2 }]}>
          {t('hydration.card.todayProgress', { current: todayTotal, target: targetMl })}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barWrap}>
        <HydrationProgressBar currentMl={todayTotal} targetMl={targetMl} />
      </View>

      {/* Quick-add button */}
      <Pressable
        onPress={handleQuickAdd}
        style={({ pressed }) => [
          styles.quickAddBtn,
          { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('hydration.card.quickAdd')}
        // Stop propagation so tapping the button doesn't also trigger the card press.
        onStartShouldSetResponder={() => true}
      >
        <Text style={[styles.quickAddLabel, { color: colors.onAccent }]}>
          {t('hydration.card.quickAdd')}
        </Text>
      </Pressable>
    </Pressable>
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
      paddingTop: 14,
      paddingBottom: 14,
      gap: 10,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      ...Type.headline,
    },
    progress: {
      ...Type.footnote,
    },
    barWrap: {
      marginVertical: 2,
    },
    quickAddBtn: {
      borderRadius: Radius.md,
      paddingVertical: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickAddLabel: {
      ...Type.subheadline,
      fontWeight: '600',
    },
  })
}
