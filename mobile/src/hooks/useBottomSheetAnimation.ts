import { useRef, useState, useEffect } from 'react'
import { Animated } from 'react-native'

/**
 * Shared bottom-sheet slide-up animation.
 * Returns `translateY`, `overlayOpacity` for Animated.View styles
 * and `mounted` to conditionally render the sheet.
 */
export function useBottomSheetAnimation(visible: boolean, maxHeight: number) {
  const translateY = useRef(new Animated.Value(maxHeight)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      translateY.setValue(maxHeight)
      overlayOpacity.setValue(0)
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: maxHeight, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false)
      })
    }
  }, [visible])

  return { translateY, overlayOpacity, mounted }
}
