import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'

interface InviteBannerProps {
  trainerName: string
  onPress: () => void
  onDismiss: () => void
}

export function InviteBanner({ trainerName, onPress, onDismiss }: InviteBannerProps) {
  const colors = useTheme()
  const slideAnim = useRef(new Animated.Value(-80)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 18,
      stiffness: 200,
      useNativeDriver: true,
    }).start()

    const timer = setTimeout(onDismiss, 8_000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      <Pressable
        onPress={onPress}
        style={[styles.container, { backgroundColor: colors.bg2, borderColor: 'rgba(201,168,76,0.25)' }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(201,168,76,0.12)' }]}>
          <Ionicons name="person-add" size={16} color={colors.gold} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.label }]} numberOfLines={1}>
            {trainerName} invited you
          </Text>
          <Text style={[styles.sub, { color: colors.label2 }]}>
            Tap to view invitation
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.label3} />
        </Pressable>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    shadowColor: '#c9a84c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
  },
})

export default InviteBanner
