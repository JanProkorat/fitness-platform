import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'

interface AutoUnarchiveBannerProps {
  conversationName: string
  onPress: () => void
  onDismiss: () => void
}

export function AutoUnarchiveBanner({ conversationName, onPress, onDismiss }: AutoUnarchiveBannerProps) {
  const colors = useTheme()
  const slideAnim = useRef(new Animated.Value(-80)).current

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start()

    const timer = setTimeout(onDismiss, 10_000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateY: slideAnim }] }]}>
      <Pressable
        onPress={onPress}
        style={[styles.container, { backgroundColor: 'rgba(0,122,255,0.07)', borderColor: 'rgba(0,122,255,0.2)' }]}
      >
        <Text style={styles.icon}>📬</Text>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.label }]}>New message from archive</Text>
          <Text style={[styles.sub, { color: colors.label2 }]}>
            {conversationName} sent a message — conversation unarchived
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.action, { color: colors.blue }]}>OK</Text>
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
    padding: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  sub: {
    fontSize: 12,
    marginTop: 1,
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
})

export default AutoUnarchiveBanner
