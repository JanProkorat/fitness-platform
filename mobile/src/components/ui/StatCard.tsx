import React, { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: ReactNode
  /** Emoji or small element rendered in the top-right corner of the card */
  headerIcon?: string
  /** 0–1 ratio; when provided, a thin progress bar renders at the bottom */
  progress?: number
  progressColor?: string
}

export const StatCard = React.memo(function StatCard({ label, value, sub, color, icon, headerIcon, progress, progressColor }: StatCardProps) {
  const colors = useTheme()
  const barColor = progressColor ?? color ?? colors.gold

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {icon && <View style={styles.iconRow}>{icon}</View>}
      {headerIcon ? (
        <View style={styles.headerRow}>
          <Text style={[styles.label, { color: colors.label2, marginBottom: 0 }]}>{label}</Text>
          <Text style={styles.headerIconText}>{headerIcon}</Text>
        </View>
      ) : (
        <Text style={[styles.label, { color: colors.label2 }]}>{label}</Text>
      )}
      <Text style={[styles.value, { color: color ?? colors.label }]}>
        {value}
      </Text>
      {sub && <Text style={[styles.sub, { color: colors.label3 }]}>{sub}</Text>}
      {progress != null && (
        <View style={[styles.track, { backgroundColor: colors.fill, marginTop: 6 }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.md,
    padding: 12,
  },
  iconRow: {
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerIconText: {
    fontSize: 14,
  },
  label: {
    ...Type.caption2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
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

export default StatCard
