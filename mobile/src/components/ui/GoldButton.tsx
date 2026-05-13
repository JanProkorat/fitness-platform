import React from 'react'
import { Pressable, Text, View, StyleSheet, ActivityIndicator, StyleProp, ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { Type } from '@/constants/typography'

interface GoldButtonProps {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  /**
   * Optional Ionicons glyph rendered before the label. Used by bulk-complete
   * CTAs ("Mark whole day done" / "Mark all eaten" — `checkmark-done`).
   * Omit on text-only buttons.
   */
  icon?: keyof typeof Ionicons.glyphMap
  style?: StyleProp<ViewStyle>
}

export function GoldButton({ title, onPress, disabled, loading, icon, style }: GoldButtonProps) {
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
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <View style={styles.content}>
          {icon != null && <Ionicons name={icon} size={18} color={colors.onAccent} />}
          <Text style={[styles.label, { color: colors.onAccent }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  // Matches ShoppingPrepBanner's `btn` style — paddingVertical 12, no fixed
  // height, Radius.md corners.
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inner row that holds the optional icon + the label.
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Matches ShoppingPrepBanner's `btnText` — Type.subheadline + fontWeight 600.
  label: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

export default GoldButton
