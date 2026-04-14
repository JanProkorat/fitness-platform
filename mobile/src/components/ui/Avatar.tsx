import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { getInitials } from '@/lib/initials'

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
] as const

type AvatarSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<AvatarSize, { container: number; radius: number; fontSize: number }> = {
  sm: { container: 36, radius: Radius.sm, fontSize: 12 },
  md: { container: 56, radius: 18, fontSize: 17 },
  lg: { container: 80, radius: 26, fontSize: 28 },
}

interface AvatarProps {
  name: string
  size?: AvatarSize
  color?: string
}

function getColorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function Avatar({ name, size = 'md', color }: AvatarProps) {
  const colors = useTheme()
  const { container, radius, fontSize } = sizeMap[size]
  const bgColor = color ?? getColorForName(name)

  return (
    <View style={[styles.container, { width: container, height: container, borderRadius: radius, backgroundColor: bgColor }]}>
      <Text style={[styles.initials, { fontSize, color: colors.bg2 }]}>
        {getInitials(name)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
  },
})

export default Avatar
