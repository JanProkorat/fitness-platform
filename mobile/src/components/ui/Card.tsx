import React, { ReactNode } from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'

interface CardProps {
  hero?: ReactNode
  children: ReactNode
  style?: ViewStyle
}

export const Card = React.memo(function Card({ hero, children, style }: CardProps) {
  const colors = useTheme()

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }, style]}>
      {hero && <View style={styles.hero}>{hero}</View>}
      <View style={styles.body}>{children}</View>
    </View>
  )
})

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  hero: {
    overflow: 'hidden',
  },
  body: {
    padding: 16,
  },
})

export default Card
