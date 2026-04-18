import React, { useEffect, useRef } from 'react'
import { View, Text, Animated, StyleSheet } from 'react-native'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'

interface PrFlashProps {
  /** Whether the PR flash is currently visible */
  visible: boolean
  /** Called after the auto-dismiss timeout elapses */
  onDismiss: () => void
}

const DISMISS_AFTER_MS = 2200

/**
 * Auto-dismissing gold/orange pill overlay shown when the user sets a personal
 * record for an exercise within the current session.
 * Pops in on mount (scale 0.5 → 1), auto-dismisses after ~2.2 s.
 */
export function PrFlash({ visible, onDismiss }: PrFlashProps) {
  const { t } = useTranslation()
  const scale = useRef(new Animated.Value(0.5)).current
  const opacity = useRef(new Animated.Value(0)).current
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (visible) {
      // Reset and animate in
      scale.setValue(0.5)
      opacity.setValue(0)
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start()
      // Auto-dismiss
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          () => onDismiss(),
        )
      }, DISMISS_AFTER_MS)
    } else {
      opacity.setValue(0)
      scale.setValue(0.5)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [visible, onDismiss, scale, opacity])

  if (!visible) return null

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Text style={styles.trophy}>🏆</Text>
        <Text style={styles.title}>{t('training.live.prTitle')}</Text>
        <Text style={styles.subtitle}>{t('training.live.prSubtitle')}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    // Gold → orange gradient approximated with gold background
    backgroundColor: '#c9a84c',
    borderRadius: Radius.xl,
    paddingVertical: 22,
    paddingHorizontal: 36,
    alignItems: 'center',
    shadowColor: '#c9a84c',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  trophy: {
    fontSize: 40,
    lineHeight: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 6,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
})

export default PrFlash
