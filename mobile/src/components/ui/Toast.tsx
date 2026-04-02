import React, { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { BlurView } from 'expo-blur'
import { Toast } from '@/lib/toast'

export function ToastProvider() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const translateY = useRef(new Animated.Value(20)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Toast.show = (msg, duration = 2500) => {
      setMessage(msg)
      setVisible(true)
      translateY.setValue(20)
      opacity.setValue(0)
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start()
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 20, duration: 180, useNativeDriver: true }),
        ]).start(() => setVisible(false))
      }, duration)
    }
  }, [])

  if (!visible) return null

  return (
    <Animated.View
      style={[styles.toast, { opacity, transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <BlurView intensity={40} tint="dark" style={styles.blur}>
        <Text style={styles.text}>{message}</Text>
      </BlurView>
    </Animated.View>
  )
}

export default ToastProvider

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    zIndex: 9999,
  },
  blur: {
    backgroundColor: 'rgba(50,50,50,0.92)',
    borderRadius: 99,
    paddingHorizontal: 20,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  text: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
})
