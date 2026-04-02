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
}

export function StatCard({ label, value, sub, color, icon }: StatCardProps) {
  const colors = useTheme()

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {icon && <View style={styles.iconRow}>{icon}</View>}
      <Text style={[styles.value, { color: color ?? colors.label }]}>
        {value}
      </Text>
      {sub && <Text style={[styles.sub, { color: colors.label3 }]}>{sub}</Text>}
      <Text style={[styles.label, { color: colors.label2 }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.md,
    padding: 12,
  },
  iconRow: {
    marginBottom: 6,
  },
  value: {
    ...Type.title2,
  },
  sub: {
    ...Type.caption1,
    marginTop: 2,
  },
  label: {
    ...Type.caption1,
    marginTop: 4,
  },
})

export default StatCard
