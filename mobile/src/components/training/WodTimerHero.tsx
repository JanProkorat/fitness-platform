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
 *
 * The four format-specific timers were extracted to their own files during
 * the #728 decomposition (AmrapTimer.tsx, EmomTimer.tsx, TabataTimer.tsx,
 * ForTimeTimer.tsx) — this file is now just the props contract + the
 * format-based dispatcher. See `wodTimerHelpers.ts` for the shared
 * formatting helpers + `PREP_SECONDS`, and `wodTimerStyles.ts` for the
 * shared `StyleSheet`.
 */

import React from 'react'
import { View } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import type { WorkoutFormat, WodConfig, WodResult } from '@/api/wod-types'
import { AmrapTimer } from './AmrapTimer'
import { EmomTimer } from './EmomTimer'
import { TabataTimer } from './TabataTimer'
import { ForTimeTimer } from './ForTimeTimer'
import { styles } from './wodTimerStyles'

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

export default WodTimerHero
