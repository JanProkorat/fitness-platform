import React from 'react'
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { Type } from '@/constants/typography'

interface SecondaryButtonProps {
  title: string
  onPress: () => void
  disabled?: boolean
  style?: ViewStyle
}

export function SecondaryButton({ title, onPress, disabled, style }: SecondaryButtonProps) {
  const colors = useTheme()

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.fill, opacity: pressed ? 0.7 : disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: colors.label }]}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 44,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    ...Type.headline,
  },
})

export default SecondaryButton
