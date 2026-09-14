/**
 * ForTimeTimer — ForTime sub-component of WodTimerHero.
 *
 * Count-up (optionally against a time cap); single big FINISH button.
 * Extracted verbatim from WodTimerHero.tsx during the #728 decomposition —
 * timer lifecycle, refs, and haptics are unchanged.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import type { WodResult } from '@/api/wod-types'
import { formatTime, PREP_SECONDS } from './wodTimerHelpers'
import { styles } from './wodTimerStyles'

// ─── ForTime component ────────────────────────────────────────────────────────

export interface ForTimeProps {
  label: string
  timeCapSeconds: number
  onFinish: (result: WodResult) => void
}

export function ForTimeTimer({
  label: _label,
  timeCapSeconds,
  onFinish,
  onElapsedChange,
}: ForTimeProps & { onElapsedChange?: (elapsedSeconds: number) => void }) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  // Pre-roll state — same pattern as AmrapTimer / EmomTimer; gives the user
  // a 10-second "GET READY" window before the ForTime workout begins.
  const [preparing, setPreparing] = useState(true)
  const [prepElapsed, setPrepElapsed] = useState(0)

  const startedAtRef = useRef<number | null>(null)
  const prepStartedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const preparingRef = useRef(true)
  useEffect(() => {
    preparingRef.current = preparing
  }, [preparing])

  const hasCap = timeCapSeconds > 0
  const remaining = Math.max(0, timeCapSeconds - elapsed)
  const prepRemaining = Math.max(0, PREP_SECONDS - prepElapsed)
  const showPrepUI = preparing && running

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Broadcast elapsed to the parent so the roadmap progress bar can fill
  // based on time (when a cap is configured). Prep ticks don't count as
  // workout progress yet.
  useEffect(() => {
    if (!preparing) onElapsedChange?.(elapsed)
  }, [elapsed, preparing, onElapsedChange])

  const handleStart = useCallback(() => {
    const now = Date.now()
    if (preparingRef.current) {
      prepStartedAtRef.current = now - prepElapsed * 1000
    } else {
      startedAtRef.current = now - elapsed * 1000
    }
    setRunning(true)
    intervalRef.current = setInterval(() => {
      if (preparingRef.current) {
        if (!prepStartedAtRef.current) return
        const el = Math.floor((Date.now() - prepStartedAtRef.current) / 1000)
        setPrepElapsed(Math.min(PREP_SECONDS, el))
        if (el >= PREP_SECONDS) {
          // Hand off prep → ForTime workout timer.
          preparingRef.current = false
          setPreparing(false)
          setPrepElapsed(0)
          startedAtRef.current = Date.now()
          setElapsed(0)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        }
        return
      }
      if (!startedAtRef.current) return
      const el = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsed(el)
      if (hasCap && el >= timeCapSeconds) {
        // Hit the cap — pause and lock into the done state.
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setRunning(false)
        setDone(true)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      }
    }, 250)
  }, [elapsed, prepElapsed, hasCap, timeCapSeconds])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleFinish = useCallback(() => {
    handlePause()
    onFinish({ totalTimeSeconds: elapsed })
  }, [handlePause, onFinish, elapsed])

  // Manual complete — taps the checkmark icon to record the current
  // elapsed time as the user's finishing time. Same effect as the skip
  // link, just an explicit "I'm done" affordance in the icon row.
  const handleComplete = useCallback(() => {
    handlePause()
    setDone(true)
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [handlePause])

  // Reset back to the initial pose: elapsed 0, prep countdown armed. If the
  // timer is running, keep it alive and re-anchor the prep counter to "now"
  // (matches AmrapTimer.handleReset). Paused/done → clear interval+anchor.
  const handleReset = useCallback(() => {
    setElapsed(0)
    setDone(false)
    setPreparing(true)
    setPrepElapsed(0)
    preparingRef.current = true
    startedAtRef.current = null
    onElapsedChange?.(0)

    if (running) {
      prepStartedAtRef.current = Date.now()
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      prepStartedAtRef.current = null
    }
    void Haptics.selectionAsync()
  }, [running, onElapsedChange])

  // Phase-tinted background: green while running (work), red while paused
  // (started but not running, not done, not in prep), no tint during the
  // GET READY pre-roll / pre-start idle state or after the workout is done.
  // Gate is `preparing || done` (not `showPrepUI || done`) — see AmrapTimer
  // for the full rationale; idle state (preparing=true, running=false) must
  // also receive no tint.
  const phaseBg = preparing || done
    ? undefined
    : running
      ? colors.green + '20'
      : colors.red + '20'

  return (
    <View style={[styles.heroWrap, { backgroundColor: phaseBg }]}>
      {/* Top label — GET READY during prep, "Časový limit: MM:SS" otherwise.
          Hidden when no time cap is configured (timeCapSeconds === 0). */}
      {(showPrepUI || hasCap) && (
        <Text
          style={[
            styles.amrapTopLabel,
            { color: showPrepUI ? colors.label2 : colors.gold },
          ]}
        >
          {showPrepUI
            ? t('training.wod.getReady')
            : `${t('training.wod.timeCap')}: ${formatTime(timeCapSeconds)}`}
        </Text>
      )}

      {/* Big timer — counts DOWN the prep window first, then DOWN the
          remaining cap (when set) or UP the elapsed seconds (when no cap
          is configured). Flips red in the last 10 s as a warning. */}
      <Text
        style={[
          styles.bigTimer,
          {
            color: showPrepUI
              ? prepRemaining <= 3
                ? colors.red
                : colors.label2
              : hasCap && remaining <= 10 && running
                ? colors.red
                : colors.label,
          },
        ]}
      >
        {showPrepUI
          ? formatTime(prepRemaining)
          : hasCap
            ? formatTime(remaining)
            : formatTime(elapsed)}
      </Text>

      {/* Three-icon controls — Reset / Play-Pause / Complete (checkmark).
          Mirrors AmrapTimer minus the round-increment button; complete is
          the explicit "I finished the workout" affordance. */}
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel={t('training.wod.resetWorkout')}
          onPress={handleReset}
          disabled={done && elapsed === 0}
          style={[
            styles.iconBtnSecondary,
            { backgroundColor: colors.fill, borderColor: colors.sep },
          ]}
        >
          <Ionicons name="refresh" size={22} color={colors.label} />
        </Pressable>

        <Pressable
          accessibilityLabel={t('training.wod.playPause')}
          onPress={running ? handlePause : handleStart}
          disabled={done}
          style={[
            styles.iconBtnPrimary,
            { backgroundColor: colors.gold, opacity: done ? 0.4 : 1 },
          ]}
        >
          <Ionicons
            name={running ? 'pause' : 'play'}
            size={32}
            color={colors.onAccent}
            style={!running ? styles.playIconOpticalShift : undefined}
          />
        </Pressable>

        <Pressable
          accessibilityLabel={t('training.wod.finish')}
          onPress={handleComplete}
          disabled={done || elapsed === 0}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              opacity: done || elapsed === 0 ? 0.4 : 1,
            },
          ]}
        >
          <Ionicons name="checkmark" size={26} color={colors.label} />
        </Pressable>
      </View>

      {/* Bottom skip / continue link. When the user has explicitly tapped
          complete (`done === true`) the link reads "Pokračovat" and
          transitions to the workout summary; otherwise "Přeskočit workout"
          stops the timer and finalises with whatever time was logged. */}
      <Pressable onPress={handleFinish} style={styles.skipWorkoutBtn}>
        <Text style={[styles.skipWorkoutText, { color: colors.label3 }]}>
          {done
            ? t('training.wod.continueAfterDone')
            : t('training.wod.skipWorkout')}
        </Text>
      </Pressable>
    </View>
  )
}

export default ForTimeTimer
