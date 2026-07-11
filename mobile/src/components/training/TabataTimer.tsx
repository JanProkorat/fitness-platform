/**
 * TabataTimer — Tabata sub-component of WodTimerHero.
 *
 * 8×20s work / 10s rest default; distinct work/rest visuals; haptic on
 * phase change; optional reps-per-round field. Extracted verbatim from
 * WodTimerHero.tsx during the #728 decomposition — timer lifecycle, refs,
 * and haptics are unchanged.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useTranslation } from 'react-i18next'
import type { WodResult } from '@/api/wod-types'
import { formatTime, formatIntervalDuration, PREP_SECONDS } from './wodTimerHelpers'
import { styles } from './wodTimerStyles'

// ─── Tabata component ─────────────────────────────────────────────────────────

export interface TabataProps {
  label: string
  workSeconds: number
  restSeconds: number
  totalRounds: number
  onFinish: (result: WodResult) => void
  onRoundChange?: (round: number) => void
}

export function TabataTimer({ label, workSeconds, restSeconds, totalRounds, onFinish, onRoundChange }: TabataProps) {
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

export default TabataTimer
