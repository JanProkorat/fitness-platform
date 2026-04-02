import React from 'react'
import { Pressable, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { Type } from '@/constants/typography'

interface GoldButtonProps {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

export function GoldButton({ title, onPress, disabled, loading, style }: GoldButtonProps) {
  const colors = useTheme()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.gold, opacity: pressed ? 0.8 : disabled ? 0.5 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.bg2} />
      ) : (
        <Text style={[styles.label, { color: colors.bg2 }]}>{title}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  label: {
    ...Type.headline,
  },
})

export default GoldButton
