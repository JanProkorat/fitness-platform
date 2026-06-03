/**
 * WodTimerHero — full-screen format-aware timer hero.
 *
 * Renders the live-timer UI for a WOD format. Outcome-only logging:
 * no per-rep mid-round capture. Round counters bump on tap; failed rounds
 * are toggled. Final outcome flows out via onFinish(result).
 *
 * Supported formats:
 *   AMRAP   — count-up to time cap; big tap-to-bump round counter; extra-rep stepper.
 *   EMOM    — interval bell every N seconds; SlideInRight phase animation; fail-this-round button.
 *   Tabata  — 8×20s work / 10s rest default; distinct work/rest visuals; haptic on phase change;
 *             optional reps-per-round field.
 *   ForTime — count-up; single big FINISH button.
 *
 * Timer state is managed locally (no store writes during ticks).
 * Haptics fire on phase transitions via expo-haptics.
 * reanimated SlideInRight is used for EMOM interval transitions.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
} from 'react-native'
import Animated, { SlideInRight, SlideOutLeft, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import type { WorkoutFormat, WodConfig, WodResult } from '@/api/wod-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function padTwo(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0')
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${padTwo(m)}:${padTwo(s)}`
}

// Compact human-readable duration for EMOM/Tabata interval labels —
// "1 min" for whole-minute multiples, "{N} s" for sub-minute, "M:SS" for
// mixed values like 90 s (renders as "1:30 min").
function formatIntervalDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0 s'
  if (totalSeconds < 60) return `${totalSeconds} s`
  if (totalSeconds % 60 === 0) {
    const minutes = totalSeconds / 60
    return `${minutes} min`
  }
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${padTwo(s)} min`
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WodTimerHeroProps {
  /** Display name of the session or exercise */
  label: string
  /** Workout format to render */
  format: WorkoutFormat
  /** Config for the format (time cap, interval, rounds, etc.) */
  config: WodConfig
  /** Called when the WOD is complete with the outcome */
  onFinish: (result: WodResult) => void
  /** Called when the user wants to discard / go back */
  onCancel: () => void
  /**
   * Optional callback fired whenever the current round number changes inside
   * an EMOM or Tabata timer. Allows the parent to highlight the active row in
   * RoundsList. Round numbers are 1-based.
   */
  onRoundChange?: (round: number) => void
  /**
   * Optional callback fired with seconds elapsed since the AMRAP / ForTime
   * timer started, so the parent can drive a time-based progress bar in the
   * roadmap pills.
   */
  onElapsedChange?: (elapsedSeconds: number) => void
  /**
   * Optional callback fired with the AMRAP rounds-completed count whenever
   * it changes, so the parent can show per-exercise completion totals in
   * the AMRAP exercises list.
   */
  onRoundsChange?: (rounds: number) => void
}

// ─── AMRAP component ──────────────────────────────────────────────────────────

interface AmrapProps {
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

function AmrapTimer({
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

// ─── EMOM component ───────────────────────────────────────────────────────────

interface EmomProps {
  label: string
  intervalSeconds: number
  totalRounds: number
  onFinish: (result: WodResult) => void
  onRoundChange?: (round: number) => void
}

// Pre-roll seconds counted down before the first round starts. Gives the
// user a brief "GET READY" window after tapping play, before the actual
// EMOM/Tabata interval begins. Only applied at the very start — once the
// user has worked through a round (or skipped it via the icon controls),
// prep does not return on subsequent pauses/resumes.
const PREP_SECONDS = 10

function EmomTimer({ label, intervalSeconds, totalRounds, onFinish, onRoundChange }: EmomProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [currentRound, setCurrentRound] = useState(1)
  const [intervalElapsed, setIntervalElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [failedRounds, setFailedRounds] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const [animKey, setAnimKey] = useState(0)
  // Pre-roll state. `preparing` flips false the moment the prep counter
  // reaches PREP_SECONDS (or the user skips ahead via the next-round icon).
  const [preparing, setPreparing] = useState(true)
  const [prepElapsed, setPrepElapsed] = useState(0)

  const startedAtRef = useRef<number | null>(null)
  const roundStartedAtRef = useRef<number | null>(null)
  const prepStartedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Wall-clock workout timer — counts only running seconds (paused windows
  // are excluded via the same anchor-shift pattern as the round timer).
  // Independent from round-counting math so manual skip-back / skip-forward
  // don't artificially inflate or deflate the reported duration.
  const workoutStartedAtRef = useRef<number | null>(null)
  const workoutElapsedRef = useRef(0)
  // Mirror `preparing` into a ref so the setInterval callback (which captures
  // its closure once at handleStart time) can read the latest value during
  // the prep→round transition without recreating the interval.
  const preparingRef = useRef(true)
  useEffect(() => {
    preparingRef.current = preparing
  }, [preparing])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Notify parent whenever the active round changes. Sent UNCLAMPED so the
  // parent's roadmap pills / progress bar can see when every round has been
  // completed (currentRound = totalRounds + 1 in the done state); clamping
  // would freeze the progress at (N-1)/N and leave the final pill in the
  // active state forever.
  useEffect(() => {
    onRoundChange?.(currentRound)
  }, [currentRound, onRoundChange])

  const advanceRound = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    setAnimKey((k) => k + 1)
    setCurrentRound((r) => {
      const next = r + 1
      if (next > totalRounds) {
        setDone(true)
        setRunning(false)
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
      return next
    })
    roundStartedAtRef.current = Date.now()
    setIntervalElapsed(0)
  }, [totalRounds])

  const handleStart = useCallback(() => {
    const now = Date.now()
    if (preparingRef.current) {
      // Pre-roll: anchor the prep counter, preserving any accumulated prep
      // seconds across a pause/resume.
      prepStartedAtRef.current = now - prepElapsed * 1000
    } else {
      // Round timer + workout-elapsed timer: both use the same elapsed-
      // preserving anchor so pause/resume doesn't add a free segment.
      roundStartedAtRef.current = now - intervalElapsed * 1000
      workoutStartedAtRef.current = now - workoutElapsedRef.current * 1000
      if (startedAtRef.current === null) startedAtRef.current = roundStartedAtRef.current
    }
    setRunning(true)
    intervalRef.current = setInterval(() => {
      if (preparingRef.current) {
        if (!prepStartedAtRef.current) return
        const elap = Math.floor((Date.now() - prepStartedAtRef.current) / 1000)
        setPrepElapsed(Math.min(PREP_SECONDS, elap))
        if (elap >= PREP_SECONDS) {
          // Hand off from prep to round 1: flip `preparing` (also via ref
          // so the next tick takes the round branch immediately) and
          // re-anchor the round + workout-elapsed timers to "now".
          preparingRef.current = false
          setPreparing(false)
          setPrepElapsed(0)
          const transitionAt = Date.now()
          roundStartedAtRef.current = transitionAt
          workoutStartedAtRef.current = transitionAt
          workoutElapsedRef.current = 0
          startedAtRef.current = transitionAt
          setIntervalElapsed(0)
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        }
        return
      }
      if (!roundStartedAtRef.current) return
      const elap = Math.floor((Date.now() - roundStartedAtRef.current) / 1000)
      setIntervalElapsed(elap)
      // Update wall-clock workout elapsed (only ticks while running — pauses
      // don't add to it). Manual skip-forward / skip-back don't reset this
      // either, so the reported duration is real time spent.
      if (workoutStartedAtRef.current) {
        workoutElapsedRef.current = Math.floor(
          (Date.now() - workoutStartedAtRef.current) / 1000,
        )
      }
      if (elap >= intervalSeconds) {
        advanceRound()
      }
    }, 250)
  }, [intervalSeconds, advanceRound, intervalElapsed, prepElapsed])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleFinish = useCallback(() => {
    // Snapshot the wall-clock elapsed BEFORE handlePause clears the running
    // anchor — gives the real time spent on this workout, excluding pauses.
    // Manual skip-forward/back don't inflate the value because they don't
    // touch `workoutStartedAtRef`.
    if (workoutStartedAtRef.current) {
      workoutElapsedRef.current = Math.floor(
        (Date.now() - workoutStartedAtRef.current) / 1000,
      )
    }
    handlePause()
    // `currentRound` is the ACTIVE round (1-based, 1 = "about to start
    // round 1, no rounds done yet"). Completed = currentRound − 1, clamped
    // to [0, totalRounds]. Without the −1 a freshly-mounted hero that the
    // user skips reports "1/10 rounds done" instead of the correct 0/10.
    const roundsCompleted = Math.max(0, Math.min(totalRounds, currentRound - 1))
    onFinish({
      roundsCompleted,
      failedRounds,
      totalTimeSeconds: workoutElapsedRef.current,
    })
  }, [handlePause, onFinish, currentRound, totalRounds, failedRounds])

  // Manual round step-back: rewind to the previous round, reset the elapsed
  // counter for the new round, and re-anchor the timer to "now" if running.
  // No-op during prep (round 1 isn't reachable yet).
  const handleStepBack = useCallback(() => {
    if (preparing) return
    if (currentRound <= 1) return
    void Haptics.selectionAsync()
    setAnimKey((k) => k + 1)
    setCurrentRound((r) => Math.max(1, r - 1))
    setIntervalElapsed(0)
    if (running) {
      roundStartedAtRef.current = Date.now()
    }
  }, [currentRound, running, preparing])

  // Manual round step-forward: skip the prep window and start round 1, OR
  // advance to the next round if already past prep. Reuses advanceRound for
  // the round-to-round case (handles the done-state transition).
  const handleStepForward = useCallback(() => {
    if (done) return
    if (preparing) {
      void Haptics.selectionAsync()
      preparingRef.current = false
      setPreparing(false)
      setPrepElapsed(0)
      if (running) {
        const now = Date.now()
        roundStartedAtRef.current = now
        startedAtRef.current = now
        setIntervalElapsed(0)
      }
      return
    }
    advanceRound()
  }, [done, advanceRound, preparing, running])

  // Done-state retry: tear down any active timer and zero everything so the
  // hero returns to its initial idle state (round 1, prep armed, 00:00).
  // The user then taps play to start the prep countdown again.
  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCurrentRound(1)
    setIntervalElapsed(0)
    setRunning(false)
    setFailedRounds([])
    setDone(false)
    setAnimKey((k) => k + 1)
    setPreparing(true)
    setPrepElapsed(0)
    preparingRef.current = true
    startedAtRef.current = null
    roundStartedAtRef.current = null
    prepStartedAtRef.current = null
    workoutStartedAtRef.current = null
    workoutElapsedRef.current = 0
    void Haptics.selectionAsync()
  }, [])

  const isFailedRound = failedRounds.includes(currentRound)
  const prepRemaining = Math.max(0, PREP_SECONDS - prepElapsed)
  // Show GET READY (label + countdown) only while the prep counter is
  // actively ticking — i.e. user has tapped play and prep hasn't completed.
  // Before the first tap the round 1 label + 00:00 timer are shown so the
  // hero looks idle, not like it's already counting down.
  const showPrepUI = preparing && running

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
      {/* Round progress (or "GET READY" eyebrow during the pre-roll). */}
      <Animated.View key={animKey} entering={SlideInRight.duration(220)} exiting={SlideOutLeft.duration(180)}>
        <Text
          style={[
            styles.roundBadge,
            {
              color: showPrepUI
                ? colors.label2
                : isFailedRound
                  ? colors.red
                  : colors.gold,
            },
          ]}
        >
          {showPrepUI
            ? t('training.wod.getReady')
            : t('training.wod.roundOf', {
                current: Math.min(currentRound, totalRounds),
                total: totalRounds,
              })}
        </Text>
        {/* Interval-per-round hint — always visible (including during the
            prep countdown) so the card height doesn't jump when entering
            or leaving prep. */}
        <Text style={[styles.intervalHint, { color: colors.label3 }]}>
          {t('training.wod.intervalPerRound', {
            duration: formatIntervalDuration(intervalSeconds),
          })}
        </Text>
      </Animated.View>

      {/* Big timer — during the prep countdown, count DOWN from PREP_SECONDS
          to 00:00. Otherwise count UP through the interval (00:00 →
          intervalSeconds) and advance round. Once every round is done the
          timer freezes at the interval cap until the user taps retry —
          otherwise it would snap back to 00:00 after `advanceRound`. */}
      <Text
        style={[
          styles.bigTimer,
          {
            color: showPrepUI
              ? prepRemaining <= 3
                ? colors.red
                : colors.label2
              : running && intervalElapsed >= intervalSeconds - 5
                ? colors.red
                : colors.label,
          },
        ]}
      >
        {showPrepUI
          ? formatTime(prepRemaining)
          : done
            ? formatTime(intervalSeconds)
            : formatTime(intervalElapsed)}
      </Text>

      {/* Failed rounds display */}
      {failedRounds.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={[styles.failedRoundsText, { color: colors.red }]}>
            {t('training.wod.failedRoundsLabel')}: {failedRounds.join(', ')}
          </Text>
        </Animated.View>
      )}

      {/* Three-icon controls row: previous round / play-pause-or-retry /
          next round. The row stays visible in the done state too — the
          centre button just swaps to a refresh icon that resets the timer
          and arms prep again. Side buttons disable in the done state since
          stepping rounds isn't meaningful past the last interval. */}
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel={t('training.wod.previousRound')}
          onPress={handleStepBack}
          disabled={done || preparing || currentRound <= 1}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              opacity: done || preparing || currentRound <= 1 ? 0.4 : 1,
            },
          ]}
        >
          <Ionicons name="play-skip-back" size={22} color={colors.label} />
        </Pressable>

        <Pressable
          accessibilityLabel={t('training.wod.playPause')}
          onPress={done ? handleReset : running ? handlePause : handleStart}
          style={[styles.iconBtnPrimary, { backgroundColor: colors.gold }]}
        >
          <Ionicons
            name={done ? 'refresh' : running ? 'pause' : 'play'}
            size={32}
            color={colors.onAccent}
            // Optical centering: only the `play` glyph needs the right-shift
            // — `pause` and `refresh` are symmetric and centre correctly.
            style={!done && !running ? styles.playIconOpticalShift : undefined}
          />
        </Pressable>

        <Pressable
          accessibilityLabel={t('training.wod.nextRound')}
          onPress={handleStepForward}
          disabled={done || (!preparing && currentRound >= totalRounds)}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              // On the last round (or when done) there's no next round to
              // skip to — user should use "Skip workout" to wrap up.
              opacity:
                done || (!preparing && currentRound >= totalRounds)
                  ? 0.4
                  : 1,
            },
          ]}
        >
          <Ionicons name="play-skip-forward" size={22} color={colors.label} />
        </Pressable>
      </View>

      {/* Small bottom link below the controls — stops the timer and forwards
          to the workout summary via the parent's onFinish. Label is "Skip
          workout" while still in progress, and "Continue" once all rounds
          are done so the user keeps a single, consistent way out (no
          separate green "Save result" CTA). Both routes call handleFinish
          which transitions the runner to the section-finished interstitial. */}
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

// ─── Tabata component ─────────────────────────────────────────────────────────

interface TabataProps {
  label: string
  workSeconds: number
  restSeconds: number
  totalRounds: number
  onFinish: (result: WodResult) => void
  onRoundChange?: (round: number) => void
}

function TabataTimer({ label, workSeconds, restSeconds, totalRounds, onFinish, onRoundChange }: TabataProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  type TabataPhase = 'work' | 'rest'

  const [phase, setPhase] = useState<TabataPhase>('work')
  const [currentRound, setCurrentRound] = useState(1)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  // repsByRound: optional per-round reps (index 0 = round 1)
  const [repsByRound, setRepsByRound] = useState<(number | null)[]>(
    Array.from({ length: totalRounds }, () => null),
  )
  // Pre-roll mirror — see EmomTimer for the full rationale.
  const [preparing, setPreparing] = useState(true)
  const [prepElapsed, setPrepElapsed] = useState(0)

  const phaseStartedAtRef = useRef<number | null>(null)
  const prepStartedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Wall-clock workout timer — see EmomTimer for the rationale (only ticks
  // while running, excludes pauses, immune to manual step-back / step-forward).
  const workoutStartedAtRef = useRef<number | null>(null)
  const workoutElapsedRef = useRef(0)
  const preparingRef = useRef(true)
  useEffect(() => {
    preparingRef.current = preparing
  }, [preparing])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Send UNCLAMPED currentRound — see EmomTimer for the same rationale
  // (clamping freezes the progress bar at (N-1)/N when all rounds are done).
  useEffect(() => {
    onRoundChange?.(currentRound)
  }, [currentRound, onRoundChange])

  const advancePhase = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    setPhase((p) => {
      if (p === 'work') {
        return 'rest'
      }
      // rest → next round work
      setCurrentRound((r) => {
        const next = r + 1
        if (next > totalRounds) {
          setDone(true)
          setRunning(false)
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        }
        // Always return `next` (matches EmomTimer.advanceRound). Returning
        // the unchanged `r` on the last round's rest end froze
        // `currentRound` at `totalRounds`, so `onRoundChange` never fired
        // with `totalRounds + 1` — the RoadmapPills progress bar stayed at
        // (N-1)/N green and the last exercise pill never turned green.
        return next
      })
      return 'work'
    })

    phaseStartedAtRef.current = Date.now()
    setPhaseElapsed(0)
  }, [totalRounds])

  const handleStart = useCallback(() => {
    const now = Date.now()
    if (preparingRef.current) {
      prepStartedAtRef.current = now - prepElapsed * 1000
    } else {
      // Preserve `phaseElapsed` + workout-elapsed across pause/resume.
      phaseStartedAtRef.current = now - phaseElapsed * 1000
      workoutStartedAtRef.current = now - workoutElapsedRef.current * 1000
    }
    setRunning(true)
    intervalRef.current = setInterval(() => {
      if (preparingRef.current) {
        if (!prepStartedAtRef.current) return
        const elap = Math.floor((Date.now() - prepStartedAtRef.current) / 1000)
        setPrepElapsed(Math.min(PREP_SECONDS, elap))
        if (elap >= PREP_SECONDS) {
          // Hand off prep → round 1 work phase. Anchor the workout-elapsed
          // timer here so manual step-back / step-forward don't affect it.
          preparingRef.current = false
          setPreparing(false)
          setPrepElapsed(0)
          const transitionAt = Date.now()
          phaseStartedAtRef.current = transitionAt
          workoutStartedAtRef.current = transitionAt
          workoutElapsedRef.current = 0
          setPhase('work')
          setPhaseElapsed(0)
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        }
        return
      }
      if (!phaseStartedAtRef.current) return
      const elap = Math.floor((Date.now() - phaseStartedAtRef.current) / 1000)
      setPhaseElapsed(elap)
      if (workoutStartedAtRef.current) {
        workoutElapsedRef.current = Math.floor(
          (Date.now() - workoutStartedAtRef.current) / 1000,
        )
      }
      setPhase((p) => {
        const cap = p === 'work' ? workSeconds : restSeconds
        if (elap >= cap) {
          advancePhase()
        }
        return p
      })
    }, 250)
  }, [workSeconds, restSeconds, advancePhase, phaseElapsed, prepElapsed])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleFinish = useCallback(() => {
    // Snapshot the wall-clock elapsed BEFORE handlePause clears the running
    // anchor — gives real time spent on the workout, excluding pauses and
    // unaffected by manual step-back / step-forward.
    if (workoutStartedAtRef.current) {
      workoutElapsedRef.current = Math.floor(
        (Date.now() - workoutStartedAtRef.current) / 1000,
      )
    }
    handlePause()
    const totalReps = repsByRound.reduce<number>((sum, r) => sum + (r ?? 0), 0)
    // See EmomTimer.handleFinish — `currentRound` is the active round, so
    // completed rounds = currentRound − 1 (clamped to [0, totalRounds]).
    const roundsCompleted = Math.max(0, Math.min(totalRounds, currentRound - 1))
    onFinish({
      roundsCompleted,
      repsByRound: repsByRound.map((r) => r ?? 0),
      totalTimeSeconds: workoutElapsedRef.current,
      extraReps: totalReps,
    })
  }, [handlePause, onFinish, currentRound, totalRounds, repsByRound])

  // Manual round step-back — rewinds to the previous round's work phase.
  // No-op during prep (round 1 isn't reachable yet).
  const handleStepBack = useCallback(() => {
    if (preparing) return
    if (currentRound <= 1) return
    void Haptics.selectionAsync()
    setCurrentRound((r) => Math.max(1, r - 1))
    setPhase('work')
    setPhaseElapsed(0)
    if (running) {
      phaseStartedAtRef.current = Date.now()
    }
  }, [currentRound, running, preparing])

  // Manual round step-forward — skips prep and starts round 1 if currently
  // preparing, otherwise advances round (or flips done on the last round).
  const handleStepForward = useCallback(() => {
    if (done) return
    if (preparing) {
      void Haptics.selectionAsync()
      preparingRef.current = false
      setPreparing(false)
      setPrepElapsed(0)
      if (running) {
        phaseStartedAtRef.current = Date.now()
        setPhase('work')
        setPhaseElapsed(0)
      }
      return
    }
    if (currentRound >= totalRounds) {
      setDone(true)
      setRunning(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      return
    }
    void Haptics.selectionAsync()
    setCurrentRound((r) => r + 1)
    setPhase('work')
    setPhaseElapsed(0)
    if (running) {
      phaseStartedAtRef.current = Date.now()
    }
  }, [currentRound, totalRounds, done, running, preparing])

  // Done-state retry — see EmomTimer.handleReset for the same rationale.
  const handleReset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setPhase('work')
    setCurrentRound(1)
    setPhaseElapsed(0)
    setRunning(false)
    setDone(false)
    setRepsByRound(Array.from({ length: totalRounds }, () => null))
    setPreparing(true)
    setPrepElapsed(0)
    preparingRef.current = true
    phaseStartedAtRef.current = null
    prepStartedAtRef.current = null
    workoutStartedAtRef.current = null
    workoutElapsedRef.current = 0
    void Haptics.selectionAsync()
  }, [totalRounds])

  const isWork = phase === 'work'
  const prepRemaining = Math.max(0, PREP_SECONDS - prepElapsed)
  // GET READY visible only while the prep counter is actively running — see
  // EmomTimer's `showPrepUI` for the same rationale.
  const showPrepUI = preparing && running

  // Phase-tinted background for the Tabata hero region — green on work
  // (running), red on rest or while paused, neutral (no tint) during the
  // pre-roll countdown, pre-start idle state, or once done. Uses the same
  // hex-alpha suffix pattern as phaseChip (`colors.gold + '22'`), so
  // the tint reads clearly without overpowering card text. Both `isWork`
  // and `preparing` derive from the same `phase` / `preparing` state, so
  // the background flips in the same React render as the phase chip label
  // with zero stale-color flash at the work ↔ rest boundary.
  // Gate is `preparing || done` (not `showPrepUI || done`) so the initial
  // idle state (preparing=true, running=false) also shows no tint.
  // During prep/idle/done `phaseBg` is `undefined`; RN treats `undefined`
  // as a no-op for `backgroundColor`, falling through to `styles.heroWrap`'s
  // default surface — the neutral look is intentional.
  const phaseBg = preparing || done
    ? undefined
    : !running
      ? colors.red + '20'
      : isWork
        ? colors.green + '20'
        : colors.red + '20'

  return (
    <View style={[styles.heroWrap, { backgroundColor: phaseBg }]}>
      <Text style={[styles.formatLabel, { color: colors.label3 }]}>
        {label}
      </Text>

      {/* Phase indicator — always rendered so the card height stays
          constant across prep / work / rest transitions. Text + color
          swap based on phase; during prep, the chip carries the upcoming
          "Work · Ns" text in the neutral fill color (the GET READY label
          itself lives in the round-badge slot below). */}
      <View
        style={[
          styles.phaseChip,
          {
            backgroundColor: showPrepUI
              ? colors.fill
              : isWork
                ? colors.gold + '22'
                : colors.fill,
            borderColor: showPrepUI
              ? colors.sep
              : isWork
                ? colors.gold
                : colors.sep,
          },
        ]}
      >
        <Text
          style={[
            styles.phaseChipText,
            {
              color: showPrepUI
                ? colors.label2
                : isWork
                  ? colors.gold
                  : colors.label2,
            },
          ]}
        >
          {isWork
            ? t('training.wod.workPhase', { seconds: workSeconds })
            : t('training.wod.restPhase', { seconds: restSeconds })}
        </Text>
      </View>

      {/* Round progress (or "GET READY" eyebrow during the pre-roll). */}
      <Text style={[styles.roundBadge, { color: colors.gold }]}>
        {showPrepUI
          ? t('training.wod.getReady')
          : t('training.wod.roundOf', {
              current: Math.min(currentRound, totalRounds),
              total: totalRounds,
            })}
      </Text>

      {/* Big timer — see EmomTimer; counts DOWN while the prep countdown is
          running, UP otherwise (work / rest phase elapsed). Uses the
          default label color so it renders black in light mode / white
          in dark mode regardless of phase. */}
      <Text
        style={[
          styles.bigTimer,
          { color: colors.label },
        ]}
      >
        {showPrepUI
          ? formatTime(prepRemaining)
          : done
            ? formatTime(isWork ? workSeconds : restSeconds)
            : formatTime(phaseElapsed)}
      </Text>

      {/* Reps input removed — Tabata is timed-only; users track reps in
          their training log post-workout. Keeping the live hero focused
          on phase + timer + controls also stops the card from resizing
          when the phase flips. */}

      {/* Three-icon controls — same layout / behaviour as EmomTimer; centre
          icon swaps to refresh in the done state to reset the timer. */}
      <View style={styles.controlsRow}>
        <Pressable
          accessibilityLabel={t('training.wod.previousRound')}
          onPress={handleStepBack}
          disabled={done || preparing || currentRound <= 1}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              opacity: done || preparing || currentRound <= 1 ? 0.4 : 1,
            },
          ]}
        >
          <Ionicons name="play-skip-back" size={22} color={colors.label} />
        </Pressable>

        <Pressable
          accessibilityLabel={t('training.wod.playPause')}
          onPress={done ? handleReset : running ? handlePause : handleStart}
          style={[styles.iconBtnPrimary, { backgroundColor: colors.gold }]}
        >
          <Ionicons
            name={done ? 'refresh' : running ? 'pause' : 'play'}
            size={32}
            color={colors.onAccent}
            style={!done && !running ? styles.playIconOpticalShift : undefined}
          />
        </Pressable>

        <Pressable
          accessibilityLabel={t('training.wod.nextRound')}
          onPress={handleStepForward}
          disabled={done || (!preparing && currentRound >= totalRounds)}
          style={[
            styles.iconBtnSecondary,
            {
              backgroundColor: colors.fill,
              borderColor: colors.sep,
              opacity:
                done || (!preparing && currentRound >= totalRounds)
                  ? 0.4
                  : 1,
            },
          ]}
        >
          <Ionicons name="play-skip-forward" size={22} color={colors.label} />
        </Pressable>
      </View>

      {/* Bottom link — "Skip workout" while in progress, "Continue" once
          done. Both call handleFinish; see EmomTimer for the full rationale. */}
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

// ─── ForTime component ────────────────────────────────────────────────────────

interface ForTimeProps {
  label: string
  timeCapSeconds: number
  onFinish: (result: WodResult) => void
}

function ForTimeTimer({
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

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * WodTimerHero — selects the right sub-component based on `format`.
 */
export function WodTimerHero({
  label,
  format,
  config,
  onFinish,
  onCancel,
  onRoundChange,
  onElapsedChange,
  onRoundsChange,
}: WodTimerHeroProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const renderTimer = () => {
    switch (format) {
      case 'AMRAP':
        return (
          <AmrapTimer
            label={label}
            timeCapSeconds={config.timeCapSeconds ?? 600}
            onFinish={onFinish}
            onElapsedChange={onElapsedChange}
            onRoundsChange={onRoundsChange}
          />
        )
      case 'EMOM':
        return (
          <EmomTimer
            label={label}
            intervalSeconds={config.intervalSeconds ?? 60}
            totalRounds={config.totalRounds ?? 10}
            onFinish={onFinish}
            onRoundChange={onRoundChange}
          />
        )
      case 'Tabata':
        return (
          <TabataTimer
            label={label}
            workSeconds={config.workSeconds ?? 20}
            restSeconds={config.restSeconds ?? 10}
            totalRounds={config.totalRounds ?? 8}
            onFinish={onFinish}
            onRoundChange={onRoundChange}
          />
        )
      case 'ForTime':
        return (
          <ForTimeTimer
            label={label}
            timeCapSeconds={config.timeCapSeconds ?? 0}
            onFinish={onFinish}
            onElapsedChange={onElapsedChange}
          />
        )
      default:
        return null
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}>
        {renderTimer()}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    // No bottom padding — the runner's `sectionHdrWrap` (paddingTop 8) below
    // owns the gap between the timer card and the PLÁN KOL header, matching
    // the SÉRIE TOHOTO CVIKU rhythm in standard sections.
    paddingBottom: 0,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  heroWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
    // Tighter than the previous 24 — the card felt overly airy. Combined
    // with bigTimer.lineHeight ≈ fontSize, finishBtn paddingVertical 0
    // and primaryBtn marginTop 0, every visible gap is ~16 px.
    gap: 16,
  },
  formatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
    marginBottom: 4,
  },
  bigTimer: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
    // Line-height matches fontSize so the textbox hugs the glyphs without
    // adding extra whitespace below — keeps the visible gap below the
    // timer equal to the configured `heroWrap.gap`.
    lineHeight: 72,
  },
  timerCaption: {
    fontSize: 12,
    marginTop: -4,
  },
  roundBadge: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // Label used by AmrapTimer above the big timer — same size/weight as
  // the EMOM `roundBadge` so the two formats read at the same visual
  // weight, just title-case for the longer "Počet kol: N" string.
  amrapTopLabel: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // Sub-line under the round badge — surfaces the per-round interval so the
  // user knows how long each round is before pressing play.
  intervalHint: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  roundCounter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  roundCounterValue: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 62,
    letterSpacing: -1,
  },
  roundCounterLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
  },
  roundCounterHint: {
    fontSize: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  repInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  stepperLabel: {
    fontSize: 13,
  },
  miniStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    height: 38,
    overflow: 'hidden',
  },
  miniStepBtn: {
    width: 36,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepText: {
    fontSize: 20,
    fontWeight: '500',
  },
  miniStepValue: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  failedRoundsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  phaseChip: {
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  phaseChipText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 13,
  },
  primaryBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    // marginTop removed — spacing now comes purely from `heroWrap.gap: 4`
    // so the gap between the round-counter button and the start button is
    // the same 4 px as the gap between the big-timer countdown and the
    // round counter above it.
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  finishBtn: {
    alignItems: 'center',
    // No inner vertical padding — spacing comes from heroWrap.gap so the
    // DOKONČIT row sits at the same distance from the Start button as the
    // other components.
    paddingVertical: 0,
  },
  finishBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  finishLargeBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  finishLargeBtnText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  failRoundBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  failRoundBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Three-icon control row used by EmomTimer + TabataTimer for prev / play /
  // next. Centred, spaced; the centre play-pause is the gold accent and
  // larger than the side step buttons.
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 4,
  },
  iconBtnSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Optical correction for the `play` triangle — see Ionicons usage above.
  playIconOpticalShift: {
    marginLeft: 3,
  },
  // Small "skip workout" link below the control row — neutral text, no
  // background. Tapping it stops the timer and finalises the workout via
  // the parent's onFinish (which forwards to the section-finished summary).
  skipWorkoutBtn: {
    alignItems: 'center',
    paddingVertical: 2,
    marginTop: 0,
  },
  skipWorkoutText: {
    fontSize: 13,
    fontWeight: '500',
  },
})

export default WodTimerHero
