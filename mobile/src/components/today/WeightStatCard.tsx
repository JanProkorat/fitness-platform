import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface WeightStatCardProps {
  /** Most recent weight in kg, or null if no data */
  latestWeight: number | null
  /** Difference between the latest measurement and the one before it (positive = gain) */
  weightDelta: number | null
}

export const WeightStatCard = React.memo(function WeightStatCard({
  latestWeight,
  weightDelta,
}: WeightStatCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()

  const hasData = latestWeight != null
  const deltaColor =
    weightDelta != null
      ? weightDelta <= 0
        ? colors.green
        : colors.orange
      : undefined

  const deltaText =
    weightDelta != null
      ? `${weightDelta < 0 ? '↓' : weightDelta > 0 ? '↑' : ''} ${Math.abs(weightDelta).toFixed(1).replace('.', ',')}`
      : hasData
        ? null
        : t('today.noMeasurements')

  return (
    <Pressable
      onPress={() => router.push('/(client)/(tabs)/profile')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.bg2, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.label2 }]}>{t('today.weight')}</Text>
        <Text style={styles.icon}>⚖️</Text>
      </View>

      {/* Value */}
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.label }]}>
          {hasData ? latestWeight.toFixed(1).replace('.', ',') : '—'}
        </Text>
        {hasData && (
          <Text style={[styles.unit, { color: colors.label2 }]}>kg</Text>
        )}
      </View>

      {/* Delta between the last two measurements */}
      {deltaText != null && (
        <Text style={[styles.delta, { color: deltaColor ?? colors.label3 }]}>
          {deltaText}
        </Text>
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
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
  icon: {
    fontSize: 14,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    ...Type.title2,
  },
  unit: {
    ...Type.caption1,
  },
  delta: {
    ...Type.caption2,
    fontWeight: '600',
    marginTop: 8,
  },
})

export default WeightStatCard
