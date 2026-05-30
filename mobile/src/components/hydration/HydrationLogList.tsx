/**
 * HydrationLogList — today's drink entries, newest first.
 *
 * Each row shows the time and amount. A delete button removes the entry.
 * Displays an empty-state message when there are no entries for today.
 */

import React, { useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import type { DrinkLog } from '@/stores/hydrationStore'

interface HydrationLogListProps {
  drinks: DrinkLog[]
  onRemove: (id: string) => void
}

function formatTime(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function HydrationLogList({ drinks, onRemove }: HydrationLogListProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()
  const styles = makeStyles(colors)

  if (drinks.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.label3 }]}>
          {t('hydration.log.empty')}
        </Text>
      </View>
    )
  }

  // Newest first
  const sorted = [...drinks].sort(
    (a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime(),
  )

  return (
    <View style={styles.container}>
      {sorted.map((drink) => (
        <DrinkRow key={drink.id} drink={drink} onRemove={onRemove} />
      ))}
    </View>
  )
}

// ─── DrinkRow ─────────────────────────────────────────────────────────────────

interface DrinkRowProps {
  drink: DrinkLog
  onRemove: (id: string) => void
}

function DrinkRow({ drink, onRemove }: DrinkRowProps): React.ReactElement {
  const { t } = useTranslation()
  const colors = useTheme()
  const styles = makeRowStyles(colors)

  const handleRemove = useCallback(() => {
    onRemove(drink.id)
  }, [onRemove, drink.id])

  return (
    <View style={[styles.row, { borderBottomColor: colors.sep }]}>
      <Text style={[styles.time, { color: colors.label3 }]}>{formatTime(drink.timestampISO)}</Text>
      <Text style={[styles.amount, { color: colors.label }]}>
        {t('hydration.log.amountMl', { amount: drink.amountMl })}
      </Text>
      <Pressable
        onPress={handleRemove}
        hitSlop={8}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={t('hydration.log.removeDrink')}
      >
        <Text style={[styles.removeBtn, { color: colors.red }]}>✕</Text>
      </Pressable>
    </View>
  )
}

export default HydrationLogList

// ─── Styles ──────────────────────────────────────────────────────────────────

type Colors = ReturnType<typeof useTheme>

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 16,
    },
    empty: {
      paddingHorizontal: 16,
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      ...Type.footnote,
      textAlign: 'center',
    },
  })
}

function makeRowStyles(colors: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 10,
    },
    time: {
      ...Type.footnote,
      minWidth: 42,
    },
    amount: {
      flex: 1,
      ...Type.subheadline,
      fontWeight: '600',
    },
    removeBtn: {
      ...Type.footnote,
      fontWeight: '600',
    },
  })
}
