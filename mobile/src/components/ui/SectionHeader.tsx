import React, { ReactNode } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'

interface SectionHeaderProps {
  title: string
  action?: ReactNode
  onActionPress?: () => void
  actionLabel?: string
}

export function SectionHeader({ title, action, onActionPress, actionLabel }: SectionHeaderProps) {
  const colors = useTheme()

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.label }]}>{title}</Text>
      {action}
      {!action && actionLabel && onActionPress && (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={[styles.action, { color: colors.gold }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    ...Type.title3,
  },
  action: {
    ...Type.subheadline,
  },
})

export default SectionHeader
