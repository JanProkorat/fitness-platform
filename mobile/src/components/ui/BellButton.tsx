import React from 'react'
import { Pressable, View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'

interface BellButtonProps {
  count: number
  onPress: () => void
  style?: ViewStyle
}

export function BellButton({ count, onPress, style }: BellButtonProps) {
  const colors = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, { backgroundColor: colors.fill }, style]}
    >
      <Ionicons name="notifications-outline" size={20} color={colors.label} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  )
}

export default BellButton

const styles = StyleSheet.create({
  container: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
})
