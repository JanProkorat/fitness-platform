import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'

interface SessionChipProps {
  label: string
  active?: boolean
  onPress?: () => void
}

export function SessionChip({ label, active, onPress }: SessionChipProps) {
  const colors = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.gold : colors.fill,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: active ? colors.onGoldChip : colors.label2 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  label: {
    ...Type.caption1,
    fontWeight: '600',
  },
})

export default SessionChip
