/**
 * EmomTimer — EMOM sub-component of WodTimerHero.
 *
 * Interval bell every N seconds; SlideInRight phase animation; fail-this-
 * round button. Extracted verbatim from WodTimerHero.tsx during the #728
 * decomposition — timer lifecycle, refs, haptics, and reanimated props are
 * unchanged.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import Animated, { SlideInRight, SlideOutLeft, FadeIn } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import type { WodResult } from '@/api/wod-types'
import { formatTime, formatIntervalDuration, PREP_SECONDS } from './wodTimerHelpers'
import { styles } from './wodTimerStyles'

// ─── EMOM component ───────────────────────────────────────────────────────────

export interface EmomProps {
  label: string
  intervalSeconds: number
  totalRounds: number
  onFinish: (result: WodResult) => void
  onRoundChange?: (round: number) => void
}

export function EmomTimer({ label, intervalSeconds, totalRounds, onFinish, onRoundChange }: EmomProps) {
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

export default EmomTimer
