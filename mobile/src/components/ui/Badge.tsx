import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

type BadgeVariant = 'active' | 'warning' | 'inactive' | 'gold'

interface BadgeProps {
  label: string
  variant?: BadgeVariant
}

export function Badge({ label, variant = 'active' }: BadgeProps) {
  const colors = useTheme()

  const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
    active: { bg: colors.green + '20', text: colors.green },
    warning: { bg: colors.orange + '20', text: colors.orange },
    inactive: { bg: colors.fill, text: colors.label3 },
    gold: { bg: colors.goldBg, text: colors.gold },
  }

  const { bg, text } = variantStyles[variant]

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    ...Type.caption1,
    fontWeight: '600',
  },
})

export default Badge
