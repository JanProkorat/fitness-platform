/**
 * AmrapTimer — AMRAP sub-component of WodTimerHero.
 *
 * Count-up to time cap; big tap-to-bump round counter; extra-rep stepper.
 * Extracted verbatim from WodTimerHero.tsx during the #728 decomposition —
 * timer lifecycle, refs, haptics, and JSX are unchanged.
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

// ─── AMRAP component ──────────────────────────────────────────────────────────

export interface AmrapProps {
  label: string
  timeCapSeconds: number
  onFinish: (result: WodResult) => void
  /** Broadcasts seconds elapsed to the parent so the roadmap pills can
   *  show a time-based progress bar. Fires every tick; sender is throttled
   *  to ~4 Hz by the underlying setInterval cadence. */
  onElapsedChange?: (elapsedSeconds: number) => void
  /** Broadcasts the current rounds-completed count whenever it changes, so
   *  the parent can render a per-exercise "done X×" summary in the AMRAP
   *  exercises list. */
  onRoundsChange?: (rounds: number) => void
}

export function AmrapTimer({
  label,
  timeCapSeconds,
  onFinish,
  onElapsedChange,
  onRoundsChange,
}: AmrapProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [rounds, setRounds] = useState(0)
  const [extraReps, setExtraReps] = useState(0)
  const [done, setDone] = useState(false)
  // Pre-roll state — same pattern as EmomTimer / TabataTimer; gives the user
  // a 10-second "GET READY" window before the AMRAP time-cap starts ticking.
  const [preparing, setPreparing] = useState(true)
  const [prepElapsed, setPrepElapsed] = useState(0)

  const startedAtRef = useRef<number | null>(null)
  const prepStartedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const preparingRef = useRef(true)
  useEffect(() => {
    preparingRef.current = preparing
  }, [preparing])

  const remaining = Math.max(0, timeCapSeconds - elapsed)
  const prepRemaining = Math.max(0, PREP_SECONDS - prepElapsed)
  const showPrepUI = preparing && running

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Broadcast elapsed seconds to the parent so the roadmap pills can render
  // a time-based progress bar. Fires on `elapsed` updates only — prep ticks
  // don't count as workout progress yet.
  useEffect(() => {
    if (!preparing) onElapsedChange?.(elapsed)
  }, [elapsed, preparing, onElapsedChange])

  // Broadcast rounds-completed so the AMRAP exercises list can show a
  // per-exercise "Hotovo N× · total reps" summary line below each row.
  useEffect(() => {
    onRoundsChange?.(rounds)
  }, [rounds, onRoundsChange])

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
          // Hand off prep → AMRAP time-cap timer.
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
      if (el >= timeCapSeconds) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setRunning(false)
        setDone(true)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    }, 250)
  }, [elapsed, prepElapsed, timeCapSeconds])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    startedAtRef.current = null
  }, [])

  const handleFinish = useCallback(() => {
    handlePause()
    // Capture the actual elapsed time so the summary can display the real
    // duration of the AMRAP attempt (the user may finish early via the
    // "Skip workout"/"Continue" link before the time cap runs out).
    onFinish({ roundsCompleted: rounds, extraReps, totalTimeSeconds: elapsed })
  }, [handlePause, onFinish, rounds, extraReps, elapsed])

  // Reset everything back to the initial pose: rounds 0, elapsed 0, prep
  // countdown armed. If the timer is running, KEEP it running — just
  // re-anchor the prep counter to "now" so the user sees the GET READY
  // window start over cleanly. Also resets the parent's progress bar via
  // `onElapsedChange(0)`. If the timer is paused/done, clear the interval
  // so handleStart freshly anchors on resume.
  const handleReset = useCallback(() => {
    setElapsed(0)
    setRounds(0)
    setExtraReps(0)
    setDone(false)
    setPreparing(true)
    setPrepElapsed(0)
    preparingRef.current = true
    startedAtRef.current = null

    // Reset the upper progress bar in the parent — `onElapsedChange(0)`
    // overrides whatever the timer last reported.
    onElapsedChange?.(0)

    if (running) {
      // Keep the timer alive: re-anchor the prep counter to "now". The
      // existing setInterval keeps ticking and the next tick recomputes
      // elapsed = 0 (it reads prepStartedAtRef.current which we just
      // updated), so prep restarts visibly from 00:10.
      prepStartedAtRef.current = Date.now()
    } else {
      // Paused / never started / done — clear both the interval and the
      // anchor so handleStart freshly sets them when the user taps play.
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      prepStartedAtRef.current = null
    }

    void Haptics.selectionAsync()
  }, [running, onElapsedChange])

  // Manual round increment — used by the third icon button. Disabled during
  // prep (no rounds to count yet) and when done (workout is finalised).
  const handleIncrementRound = useCallback(() => {
    if (showPrepUI || done) return
    setRounds((r) => r + 1)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [showPrepUI, done])

  // Phase-tinted background: green while running (work), red while paused
  // (started but not running, not done, not in prep), no tint during the
  // GET READY pre-roll / pre-start idle state or after the workout is done.
  // Gate is `preparing || done` (not `showPrepUI || done`) so the idle state
  // before the first Play tap — preparing=true, running=false — also gets no
  // tint. `showPrepUI` only covered the actively-ticking prep countdown and
  // left the initial idle frame falling through to red.
  const phaseBg = preparing || done
    ? undefined
    : running
      ? colors.green + '20'
      : colors.red + '20'

  return (
    <View style={[styles.heroWrap, { backgroundColor: phaseBg }]}>
      {/* Top label — GET READY during prep, "Rounds done: N" otherwise.
          Uses the refined `amrapTopLabel` style (lighter weight + smaller
          than EMOM's "Kolo 1/10" treatment). */}
      <Text
        style={[
          styles.amrapTopLabel,
          { color: showPrepUI ? colors.label2 : colors.gold },
        ]}
      >
        {showPrepUI
          ? t('training.wod.getReady')
          : `${t('training.wod.amrapRoundsLabel')}: ${rounds}`}
      </Text>

      {/* Big timer — counts DOWN the prep window first, then DOWN the
          AMRAP time cap. White by default (matches EMOM/Tabata visual
          weight); flips red in the last 10 s as a warning. */}
      <Text
        style={[
          styles.bigTimer,
          {
            color: showPrepUI
              ? prepRemaining <= 3
                ? colors.red
                : colors.label2
              : remaining <= 10 && running
                ? colors.red
                : colors.label,
          },
        ]}
      >
        {showPrepUI ? formatTime(prepRemaining) : formatTime(remaining)}
      </Text>

      {/* Three-icon controls — reset / play-pause / increment-round.
          Reset is always tappable (one tap clears the AMRAP back to the
          pre-prep idle state); increment is disabled during prep. The
          centre play-pause is the gold accent button. */}
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel={t('training.wod.resetWorkout')}
          onPress={handleReset}
          disabled={done}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              opacity: done ? 0.4 : 1,
            },
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
          accessibilityLabel={t('training.wod.tapToAddRound')}
          onPress={handleIncrementRound}
          disabled={showPrepUI || done}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              opacity: showPrepUI || done ? 0.4 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={26} color={colors.label} />
        </Pressable>
      </View>

      {/* Bottom skip-workout link — stops the timer and forwards to the
          workout summary. When the workout naturally completes (time cap
          reached), the same link reads "Continue" instead. */}
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

export default AmrapTimer
