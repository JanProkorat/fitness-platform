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
}

// ─── AMRAP component ──────────────────────────────────────────────────────────

interface AmrapProps {
  label: string
  timeCapSeconds: number
  onFinish: (result: WodResult) => void
}

function AmrapTimer({ label, timeCapSeconds, onFinish }: AmrapProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [rounds, setRounds] = useState(0)
  const [extraReps, setExtraReps] = useState(0)
  const [done, setDone] = useState(false)

  const startedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const remaining = Math.max(0, timeCapSeconds - elapsed)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleStart = useCallback(() => {
    startedAtRef.current = Date.now() - elapsed * 1000
    setRunning(true)
    intervalRef.current = setInterval(() => {
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
  }, [elapsed, timeCapSeconds])

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
    onFinish({ roundsCompleted: rounds, extraReps })
  }, [handlePause, onFinish, rounds, extraReps])

  return (
    <View style={styles.heroWrap}>
      {/* Label */}
      <Text style={[styles.formatLabel, { color: colors.label3 }]}>
        {t('training.format.amrap')} · {label}
      </Text>

      {/* Time cap countdown */}
      <Text
        style={[
          styles.bigTimer,
          { color: remaining <= 10 && running ? colors.red : colors.gold },
        ]}
      >
        {formatTime(remaining)}
      </Text>
      <Text style={[styles.timerCaption, { color: colors.label3 }]}>
        {t('training.wod.timeCap')}
      </Text>

      {/* Round counter — big tap target */}
      <Pressable
        style={[styles.roundCounter, { backgroundColor: colors.goldBg, borderColor: colors.gold }]}
        onPress={() => {
          setRounds((r) => r + 1)
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        accessibilityLabel={t('training.wod.tapToAddRound')}
      >
        <Text style={[styles.roundCounterValue, { color: colors.gold }]}>{rounds}</Text>
        <Text style={[styles.roundCounterLabel, { color: colors.label3 }]}>
          {t('training.wod.rounds')}
        </Text>
        <Text style={[styles.roundCounterHint, { color: colors.label3 }]}>
          {t('training.wod.tapToAdd')}
        </Text>
      </Pressable>

      {/* Extra reps stepper */}
      <View style={styles.stepperRow}>
        <Text style={[styles.stepperLabel, { color: colors.label2 }]}>
          {t('training.wod.extraReps')}
        </Text>
        <View style={[styles.miniStepper, { borderColor: colors.sep }]}>
          <Pressable
            style={styles.miniStepBtn}
            onPress={() => setExtraReps((r) => Math.max(0, r - 1))}
            accessibilityLabel={t('training.wod.decreaseReps')}
          >
            <Text style={[styles.miniStepText, { color: colors.label2 }]}>−</Text>
          </Pressable>
          <Text style={[styles.miniStepValue, { color: colors.gold }]}>{extraReps}</Text>
          <Pressable
            style={styles.miniStepBtn}
            onPress={() => setExtraReps((r) => r + 1)}
            accessibilityLabel={t('training.wod.increaseReps')}
          >
            <Text style={[styles.miniStepText, { color: colors.label2 }]}>+</Text>
          </Pressable>
        </View>
      </View>

      {/* Controls */}
      {!done ? (
        <>
          {!running ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
              onPress={handleStart}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {elapsed > 0 ? t('training.wod.resume') : t('training.wod.start')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.fill }]}
              onPress={handlePause}
            >
              <Text style={[styles.primaryBtnText, { color: colors.label }]}>
                {t('training.wod.pause')}
              </Text>
            </Pressable>
          )}
          <Pressable style={styles.finishBtn} onPress={handleFinish}>
            <Text style={[styles.finishBtnText, { color: colors.label3 }]}>
              {t('training.wod.finish')}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.green }]}
          onPress={handleFinish}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
            {t('training.wod.saveResult')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── EMOM component ───────────────────────────────────────────────────────────

interface EmomProps {
  label: string
  intervalSeconds: number
  totalRounds: number
  onFinish: (result: WodResult) => void
}

function EmomTimer({ label, intervalSeconds, totalRounds, onFinish }: EmomProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [currentRound, setCurrentRound] = useState(1)
  const [intervalElapsed, setIntervalElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [failedRounds, setFailedRounds] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  const startedAtRef = useRef<number | null>(null)
  const roundStartedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

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
    startedAtRef.current = now
    roundStartedAtRef.current = now
    setRunning(true)
    intervalRef.current = setInterval(() => {
      if (!roundStartedAtRef.current) return
      const elap = Math.floor((Date.now() - roundStartedAtRef.current) / 1000)
      setIntervalElapsed(elap)
      if (elap >= intervalSeconds) {
        advanceRound()
      }
    }, 250)
  }, [intervalSeconds, advanceRound])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleFailRound = useCallback(() => {
    setFailedRounds((f) =>
      f.includes(currentRound) ? f.filter((r) => r !== currentRound) : [...f, currentRound],
    )
  }, [currentRound])

  const handleFinish = useCallback(() => {
    handlePause()
    onFinish({
      roundsCompleted: Math.min(currentRound, totalRounds),
      failedRounds,
    })
  }, [handlePause, onFinish, currentRound, totalRounds, failedRounds])

  const remaining = Math.max(0, intervalSeconds - intervalElapsed)
  const isFailedRound = failedRounds.includes(currentRound)

  return (
    <View style={styles.heroWrap}>
      <Text style={[styles.formatLabel, { color: colors.label3 }]}>
        {t('training.format.emom')} · {label}
      </Text>

      {/* Round progress */}
      <Animated.View key={animKey} entering={SlideInRight.duration(220)} exiting={SlideOutLeft.duration(180)}>
        <Text
          style={[
            styles.roundBadge,
            { color: isFailedRound ? colors.red : colors.gold },
          ]}
        >
          {t('training.wod.roundOf', { current: Math.min(currentRound, totalRounds), total: totalRounds })}
        </Text>
      </Animated.View>

      {/* Interval countdown */}
      <Text
        style={[
          styles.bigTimer,
          { color: remaining <= 5 && running ? colors.red : colors.label },
        ]}
      >
        {formatTime(remaining)}
      </Text>
      <Text style={[styles.timerCaption, { color: colors.label3 }]}>
        {t('training.wod.interval')} {intervalSeconds} s
      </Text>

      {/* Failed rounds display */}
      {failedRounds.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={[styles.failedRoundsText, { color: colors.red }]}>
            {t('training.wod.failedRoundsLabel')}: {failedRounds.join(', ')}
          </Text>
        </Animated.View>
      )}

      {/* Controls */}
      {!done ? (
        <>
          {!running ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
              onPress={handleStart}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {intervalElapsed > 0 ? t('training.wod.resume') : t('training.wod.start')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.fill }]}
              onPress={handlePause}
            >
              <Text style={[styles.primaryBtnText, { color: colors.label }]}>
                {t('training.wod.pause')}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={[
              styles.failRoundBtn,
              {
                backgroundColor: isFailedRound
                  ? colors.red + '22'
                  : colors.fill,
                borderColor: isFailedRound ? colors.red : colors.sep,
              },
            ]}
            onPress={handleFailRound}
          >
            <Text
              style={[
                styles.failRoundBtnText,
                { color: isFailedRound ? colors.red : colors.label2 },
              ]}
            >
              {isFailedRound
                ? t('training.wod.unmarkFailed')
                : t('training.wod.markFailed')}
            </Text>
          </Pressable>

          <Pressable style={styles.finishBtn} onPress={handleFinish}>
            <Text style={[styles.finishBtnText, { color: colors.label3 }]}>
              {t('training.wod.finish')}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.green }]}
          onPress={handleFinish}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
            {t('training.wod.saveResult')}
          </Text>
        </Pressable>
      )}
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
}

function TabataTimer({ label, workSeconds, restSeconds, totalRounds, onFinish }: TabataProps) {
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

  const phaseStartedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

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
          return r
        }
        return next
      })
      return 'work'
    })

    phaseStartedAtRef.current = Date.now()
    setPhaseElapsed(0)
  }, [totalRounds])

  const handleStart = useCallback(() => {
    phaseStartedAtRef.current = Date.now()
    setRunning(true)
    intervalRef.current = setInterval(() => {
      if (!phaseStartedAtRef.current) return
      const elap = Math.floor((Date.now() - phaseStartedAtRef.current) / 1000)
      setPhaseElapsed(elap)
      // Check current phase duration — read phase from closure is stale; use
      // a ref-based approach instead.
      setPhase((p) => {
        const cap = p === 'work' ? workSeconds : restSeconds
        if (elap >= cap) {
          advancePhase()
        }
        return p
      })
    }, 250)
  }, [workSeconds, restSeconds, advancePhase])

  const handlePause = useCallback(() => {
    setRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleFinish = useCallback(() => {
    handlePause()
    const totalReps = repsByRound.reduce<number>((sum, r) => sum + (r ?? 0), 0)
    onFinish({
      roundsCompleted: Math.min(currentRound, totalRounds),
      repsByRound: repsByRound.map((r) => r ?? 0),
      totalTimeSeconds: totalRounds * (workSeconds + restSeconds),
      extraReps: totalReps,
    })
  }, [handlePause, onFinish, currentRound, totalRounds, repsByRound, workSeconds, restSeconds])

  const phaseCap = phase === 'work' ? workSeconds : restSeconds
  const remaining = Math.max(0, phaseCap - phaseElapsed)
  const isWork = phase === 'work'

  return (
    <View style={styles.heroWrap}>
      <Text style={[styles.formatLabel, { color: colors.label3 }]}>
        {t('training.format.tabata')} · {label}
      </Text>

      {/* Phase indicator */}
      <View
        style={[
          styles.phaseChip,
          {
            backgroundColor: isWork ? colors.gold + '22' : colors.fill,
            borderColor: isWork ? colors.gold : colors.sep,
          },
        ]}
      >
        <Text
          style={[
            styles.phaseChipText,
            { color: isWork ? colors.gold : colors.label2 },
          ]}
        >
          {isWork
            ? t('training.wod.workPhase', { seconds: workSeconds })
            : t('training.wod.restPhase', { seconds: restSeconds })}
        </Text>
      </View>

      {/* Round progress */}
      <Text style={[styles.roundBadge, { color: colors.label2 }]}>
        {t('training.wod.roundOf', { current: Math.min(currentRound, totalRounds), total: totalRounds })}
      </Text>

      {/* Countdown */}
      <Text
        style={[
          styles.bigTimer,
          { color: isWork ? colors.gold : colors.blue },
        ]}
      >
        {formatTime(remaining)}
      </Text>

      {/* Reps input for current round (only during work phase) */}
      {isWork && (
        <View style={styles.repInputRow}>
          <Text style={[styles.stepperLabel, { color: colors.label2 }]}>
            {t('training.wod.repsThisRound')}
          </Text>
          <View style={[styles.miniStepper, { borderColor: colors.sep }]}>
            <Pressable
              style={styles.miniStepBtn}
              onPress={() =>
                setRepsByRound((prev) => {
                  const next = [...prev]
                  next[currentRound - 1] = Math.max(0, (next[currentRound - 1] ?? 0) - 1)
                  return next
                })
              }
              accessibilityLabel={t('training.wod.decreaseReps')}
            >
              <Text style={[styles.miniStepText, { color: colors.label2 }]}>−</Text>
            </Pressable>
            <Text style={[styles.miniStepValue, { color: colors.gold }]}>
              {repsByRound[currentRound - 1] ?? 0}
            </Text>
            <Pressable
              style={styles.miniStepBtn}
              onPress={() =>
                setRepsByRound((prev) => {
                  const next = [...prev]
                  next[currentRound - 1] = (next[currentRound - 1] ?? 0) + 1
                  return next
                })
              }
              accessibilityLabel={t('training.wod.increaseReps')}
            >
              <Text style={[styles.miniStepText, { color: colors.label2 }]}>+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Controls */}
      {!done ? (
        <>
          {!running ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
              onPress={handleStart}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {phaseElapsed > 0 ? t('training.wod.resume') : t('training.wod.start')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.fill }]}
              onPress={handlePause}
            >
              <Text style={[styles.primaryBtnText, { color: colors.label }]}>
                {t('training.wod.pause')}
              </Text>
            </Pressable>
          )}

          <Pressable style={styles.finishBtn} onPress={handleFinish}>
            <Text style={[styles.finishBtnText, { color: colors.label3 }]}>
              {t('training.wod.finish')}
            </Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.green }]}
          onPress={handleFinish}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
            {t('training.wod.saveResult')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── ForTime component ────────────────────────────────────────────────────────

interface ForTimeProps {
  label: string
  timeCapSeconds: number
  onFinish: (result: WodResult) => void
}

function ForTimeTimer({ label, timeCapSeconds, onFinish }: ForTimeProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [cappedOut, setCappedOut] = useState(false)

  const startedAtRef = useRef<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleStart = useCallback(() => {
    startedAtRef.current = Date.now() - elapsed * 1000
    setRunning(true)
    intervalRef.current = setInterval(() => {
      if (!startedAtRef.current) return
      const el = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsed(el)
      if (timeCapSeconds > 0 && el >= timeCapSeconds) {
        clearInterval(intervalRef.current!)
        intervalRef.current = null
        setRunning(false)
        setCappedOut(true)
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      }
    }, 250)
  }, [elapsed, timeCapSeconds])

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
    onFinish({ totalTimeSeconds: elapsed })
  }, [handlePause, onFinish, elapsed])

  const cappedTime = timeCapSeconds > 0 ? formatTime(Math.max(0, timeCapSeconds - elapsed)) : null

  return (
    <View style={styles.heroWrap}>
      <Text style={[styles.formatLabel, { color: colors.label3 }]}>
        {t('training.format.forTime')} · {label}
      </Text>

      {/* Count-up */}
      <Text style={[styles.bigTimer, { color: colors.label }]}>
        {formatTime(elapsed)}
      </Text>

      {/* Time cap remaining (when set) */}
      {cappedTime !== null && (
        <Text style={[styles.timerCaption, { color: cappedOut ? colors.red : colors.label3 }]}>
          {cappedOut
            ? t('training.wod.timeCapped')
            : t('training.wod.timeCapRemaining', { time: cappedTime })}
        </Text>
      )}

      {!running ? (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.gold }]}
          onPress={handleStart}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
            {elapsed > 0 ? t('training.wod.resume') : t('training.wod.start')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.fill }]}
          onPress={handlePause}
        >
          <Text style={[styles.primaryBtnText, { color: colors.label }]}>
            {t('training.wod.pause')}
          </Text>
        </Pressable>
      )}

      {/* Big FINISH button */}
      <Pressable
        style={[styles.finishLargeBtn, { backgroundColor: colors.green }]}
        onPress={handleFinish}
      >
        <Text style={[styles.finishLargeBtnText, { color: colors.onAccent }]}>
          {t('training.wod.finish')}
        </Text>
      </Pressable>
    </View>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

/**
 * WodTimerHero — selects the right sub-component based on `format`.
 */
export function WodTimerHero({ label, format, config, onFinish, onCancel }: WodTimerHeroProps) {
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
          />
        )
      case 'EMOM':
        return (
          <EmomTimer
            label={label}
            intervalSeconds={config.intervalSeconds ?? 60}
            totalRounds={config.totalRounds ?? 10}
            onFinish={onFinish}
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
          />
        )
      case 'ForTime':
        return (
          <ForTimeTimer
            label={label}
            timeCapSeconds={config.timeCapSeconds ?? 0}
            onFinish={onFinish}
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

      {/* Cancel link */}
      <Pressable style={styles.cancelBtn} onPress={onCancel}>
        <Text style={[styles.cancelBtnText, { color: colors.label3 }]}>
          {t('common.cancel')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    flex: 1,
  },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
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
    lineHeight: 80,
  },
  timerCaption: {
    fontSize: 12,
    marginTop: -4,
  },
  roundBadge: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
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
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  finishBtn: {
    alignItems: 'center',
    paddingVertical: 10,
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
})

export default WodTimerHero
