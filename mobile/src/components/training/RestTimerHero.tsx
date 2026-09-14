import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@/hooks/useTheme'
import { Static } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import { computeRestRemaining } from './liveTrainingHelpers'

interface RestTimerHeroProps {
  /** Total rest duration in seconds */
  restSeconds: number
  /** ISO timestamp when rest started (from liveSessionStore) */
  restStartedAt: string
  /** Name of the next exercise */
  nextExerciseName: string
  /** Next set label, e.g. "Série 2 · 80 kg × 10" */
  nextSetMeta: string
  onSkipRest: () => void
}

// Ring geometry — circumference = 2π × r ≈ 452 for r=72 in 160×160 SVG
const RING_CIRC = 452
const SVG_SIZE = 160
const RING_RADIUS = 72

/**
 * Full-screen overlay shown during rest between sets.
 * Uses wall-clock math (computeRestRemaining) so the countdown survives backgrounding.
 * Ring color: gold (>50%) → orange (25–50%) → red (<25%).
 * Haptic feedback fires once when the timer reaches zero.
 */
export function RestTimerHero({
  restSeconds,
  restStartedAt,
  nextExerciseName,
  nextSetMeta,
  onSkipRest,
}: RestTimerHeroProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const hapticFired = useRef(false)

  // Tick every second, but compute remaining from wall clock so backgrounding
  // is handled correctly.
  const [remaining, setRemaining] = useState(() =>
    computeRestRemaining(restSeconds, restStartedAt),
  )

  useEffect(() => {
    hapticFired.current = false
    const id = setInterval(() => {
      const r = computeRestRemaining(restSeconds, restStartedAt)
      setRemaining(r)
      if (r <= 0 && !hapticFired.current) {
        hapticFired.current = true
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
          // Haptics may not be available in all environments — ignore errors.
        })
        onSkipRest()
        clearInterval(id)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [restSeconds, restStartedAt, onSkipRest])

  const pct = restSeconds > 0 ? remaining / restSeconds : 0
  const dashOffset = Math.round(RING_CIRC * (1 - pct))

  // Ring color thresholds matching the prototype JS
  let ringColor = colors.gold
  if (pct <= 0.25) ringColor = colors.red
  else if (pct <= 0.5) ringColor = colors.orange

  const displaySeconds = Math.ceil(remaining)

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(20,20,30,0.88)' }]}>
      <Text style={styles.restLabel}>{t('training.live.restLabel')}</Text>

      {/* Circular SVG countdown */}
      <View style={styles.ringWrap}>
        <Svg width={SVG_SIZE} height={SVG_SIZE} style={styles.ring}>
          {/* Track */}
          <Circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={10}
          />
          {/* Progress ring */}
          <Circle
            cx={SVG_SIZE / 2}
            cy={SVG_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={10}
            strokeDasharray={RING_CIRC}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            // SVG rotation: start from top
            rotation={-90}
            origin={`${SVG_SIZE / 2},${SVG_SIZE / 2}`}
          />
        </Svg>
        {/* Countdown text overlay */}
        <View style={styles.countdownInner}>
          <Text style={styles.countdownNumber}>{displaySeconds}</Text>
          <Text style={styles.countdownUnit}>{t('training.live.seconds')}</Text>
        </View>
      </View>

      {/* Next set preview */}
      <Text style={styles.nextLine} numberOfLines={2}>
        {t('training.live.nextLabel')}{' '}
        <Text style={styles.nextName}>{nextExerciseName}</Text>
        {'\n'}
        <Text style={styles.nextMeta}>{nextSetMeta}</Text>
      </Text>

      {/* Skip button */}
      <Pressable
        style={styles.skipBtn}
        onPress={onSkipRest}
        accessibilityLabel={t('training.live.skipRest')}
      >
        <Text style={styles.skipBtnText}>{t('training.live.skipRest')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  restLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.18 * 11,
  },
  ringWrap: {
    width: SVG_SIZE,
    height: SVG_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  countdownInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 52,
    fontWeight: '700',
    color: Static.alwaysWhite,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    lineHeight: 56,
  },
  countdownUnit: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  nextLine: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  nextName: {
    color: Static.alwaysWhite,
    fontWeight: '600',
  },
  nextMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  skipBtn: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.full,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 2,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Static.alwaysWhite,
  },
})

export default RestTimerHero
