import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'

interface SeparatorProps {
  inset?: number
  style?: ViewStyle
}

export const Separator = React.memo(function Separator({ inset = 0, style }: SeparatorProps) {
  const colors = useTheme()

  return (
    <View
      style={[
        styles.separator,
        { backgroundColor: colors.sep, marginLeft: inset },
        style,
      ]}
    />
  )
})

const styles = StyleSheet.create({
  separator: {
    height: StyleSheet.hairlineWidth,
  },
})

export default Separator
