/**
 * Live Training Assistant — redesigned in-place from the old free-form logger.
 *
 * Route:  /(client)/training-session/[id]
 * Params: id — the workoutLog id. Pass "new" with ?planId=&sessionId= to start fresh.
 *
 * Sub-states:
 *   prestart → running → (rest overlay) → (pr flash) → finished
 *
 * State lives in liveSessionStore (Zustand + MMKV).
 * Each user action calls updateWorkout() via the offline queue.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Brand } from '@/constants/colors'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { href } from '@/lib/navigation'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

import axios from 'axios'
import { startWorkout, updateWorkout, completeWorkout, goLive } from '@/api/workouts'
import type { UpdateWorkoutRequest } from '@/api/workouts'
import { Toast } from '@/lib/toast'
import type {
  SessionExercise,
  ExerciseSet,
  MuscleGroup,
  TrainingSection,
  WorkoutFormat,
  WodConfig,
  MovementType,
} from '@/api/training'
import { getTodaySession } from '@/api/training'
import type {
  WodResult,
  UpdateWorkoutWodRequest,
  UpdateWodExerciseRequest,
  LoggedSetDto,
} from '@/api/wod-types'
import { SectionHeader } from '@/components/training/SectionHeader'
import { ExpandableExerciseCard } from '@/components/training/ExpandableExerciseCard'
import { SetGrid } from '@/components/training/SetGrid'
import { AnimatedCollapse } from '@/components/training/AnimatedCollapse'
import {
  estimatedSectionDurationSeconds,
  formatDurationCompact,
  formatExerciseSummary,
} from '@/lib/training-plan-format'
import { getMuscleGroupColor } from '@/constants/muscleGroups'

import { useLiveSessionStore } from '@/stores/liveSessionStore'
import { addPendingMutation } from '@/stores/offline'

import { LiveSessionHeader } from '@/components/training/LiveSessionHeader'
import { LiveExerciseFocus } from '@/components/training/LiveExerciseFocus'
import { TimedExerciseFocus } from '@/components/training/TimedExerciseFocus'
import { WodTimerHero } from '@/components/training/WodTimerHero'
import { RestTimerHero } from '@/components/training/RestTimerHero'
import { PrFlash } from '@/components/training/PrFlash'
import { LiveFinishedSummary } from '@/components/training/LiveFinishedSummary'
import type { FinishedWorkoutCardData, FinishedExerciseSetData } from '@/components/training/LiveFinishedSummary'

import {
  isPR,
  computeLiveSummary,
  formatSeconds,
} from '@/components/training/liveTrainingHelpers'
import type { ExerciseSummaryInput } from '@/components/training/liveTrainingHelpers'

// ─── WOD-aware session/exercise type helpers ──────────────────────────────────

/**
 * WodAwareExercise is now just an alias for SessionExercise — all WOD fields
 * (movementType, format, formatConfig) are present in the generated type.
 * Kept as an alias to avoid churning call sites.
 */
type WodAwareExercise = SessionExercise

/**
 * The generated TrainingSession type now includes sections and WOD fields.
 */
interface WodAwareSession {
  sessionId?: string
  name?: string
  exercises?: SessionExercise[]
  sections?: TrainingSection[]
  format?: WorkoutFormat | null
  formatConfig?: WodConfig | null
}

// ─── Section helpers ──────────────────────────────────────────────────────────

/**
 * Returns effective sections for a session.
 * Falls back to a single default section wrapping flat exercises for legacy plans.
 * The section name is resolved via t() so en/de users don't see hardcoded Czech.
 */
function getEffectiveSections(
  session: WodAwareSession,
  t: (key: string) => string,
): TrainingSection[] {
  if (session.sections && session.sections.length > 0) {
    return session.sections
  }
  const exercises = session.exercises ?? []
  if (exercises.length === 0) return []
  return [
    {
      sectionId: 'default',
      order: 0,
      name: t('training.section.defaultName'),
      format: undefined,
      formatConfig: undefined,
      exercises,
    },
  ]
}

/**
 * Returns the flat exercises array for a given section, resolving format inheritance.
 * Section format inherits from session format when not explicitly set.
 */
function resolveSection(
  section: TrainingSection,
  sessionFormat: WorkoutFormat | null,
  sessionFormatConfig: WodConfig | null,
): { format: WorkoutFormat | null; formatConfig: WodConfig | null; exercises: SessionExercise[] } {
  const fmt = section.format ?? sessionFormat ?? null
  const config = section.formatConfig ?? sessionFormatConfig ?? null
  return {
    format: fmt,
    formatConfig: config,
    exercises: section.exercises ?? [],
  }
}

function isWodFormat(format: WorkoutFormat | null | undefined): format is WorkoutFormat {
  return format != null && format !== 'Standard'
}

// ─── Muscle group → color map (mirrors the prototype) ────────────────────────

// TEMP: SessionExercise DTO does not carry MuscleGroup today, so the
// tokenized `getMuscleGroupColor(mg, colors)` helper can't be used.
// This name-matching fallback mirrors the prototype. Once the backend
// surfaces `muscleGroups` on SessionExercise, switch to
// `getMuscleGroupColor(ex.muscleGroups[0], colors)` and delete this map.
const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#0b6e99',
  Shoulders: '#af52de',
  Arms: '#ff9500',
  Back: '#3ed7be',
  Triceps: '#ff9500',
  Biceps: '#ff9500',
  Quadriceps: '#34c759',
  Hamstrings: '#ff6b6b',
  Glutes: '#ff9500',
  Calves: '#5ac8fa',
  Abs: '#ff9500',
  Obliques: '#ff9500',
  LowerBack: '#3ed7be',
  Traps: '#3ed7be',
  FullBody: Brand.gold,
  // Czech translations (the API may return localized strings)
  Hrudník: '#0b6e99',
  Ramena: '#af52de',
  Paže: '#ff9500',
  Záda: '#3ed7be',
}

function muscleColorFor(exercise: SessionExercise): string {
  // exerciseName as fallback when no muscle group info is available
  const fallback = Brand.gold
  if (!exercise.exerciseName) return fallback
  // Scan muscle color keys against exercise name fragments
  for (const [key, color] of Object.entries(MUSCLE_COLORS)) {
    if (exercise.exerciseName.toLowerCase().includes(key.toLowerCase())) return color
  }
  return fallback
}

// ─── Skip-exercise confirm sheet ─────────────────────────────────────────────

interface SkipConfirmSheetProps {
  visible: boolean
  onConfirm: () => void
  onCancel: () => void
}

function SkipConfirmSheet({ visible, onConfirm, onCancel }: SkipConfirmSheetProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  if (!visible) return null
  return (
    <Animated.View
      style={[sheets.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
    >
      <Animated.View
        style={[sheets.sheet, { backgroundColor: colors.bg2 }]}
        entering={SlideInDown.duration(240)}
        exiting={SlideOutDown.duration(200)}
      >
        <Text style={[sheets.sheetTitle, { color: colors.label }]}>
          {t('training.live.skipExerciseTitle')}
        </Text>
        <Text style={[sheets.sheetMessage, { color: colors.label2 }]}>
          {t('training.live.skipExerciseMessage')}
        </Text>
        <Pressable
          style={[sheets.sheetBtnPrimary, { backgroundColor: colors.red }]}
          onPress={onConfirm}
        >
          <Text style={[sheets.sheetBtnText, { color: colors.onAccent }]}>
            {t('training.live.skipExerciseConfirm')}
          </Text>
        </Pressable>
        <Pressable
          style={[sheets.sheetBtnSecondary, { backgroundColor: colors.fill }]}
          onPress={onCancel}
        >
          <Text style={[sheets.sheetBtnTextSecondary, { color: colors.label }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const sheets = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  sheetTitle: {
    ...Type.headline,
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetMessage: {
    ...Type.footnote,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  sheetBtnPrimary: {
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetBtnSecondary: {
    borderRadius: Radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetBtnText: {
    ...Type.callout,
    fontWeight: '600',
  },
  sheetBtnTextSecondary: {
    ...Type.subheadline,
    fontWeight: '500',
  },
})

// ─── Sets-list section ────────────────────────────────────────────────────────

interface SetsListProps {
  exercise: SessionExercise
  completedSets: number[]
  skippedSets: number[]
  currentSetIdx: number
  formOverrides: Record<number, { reps?: number; weightKg?: number }>
  onGoToSet: (idx: number) => void
}

// Per-row vertical extent (paddingVertical 12 + content ~26 + paddingVertical 12).
// Used to compute the max-height (3 rows visible) and the scrollTo offset for
// the auto-scroll on currentSetIdx change.
const SET_ROW_HEIGHT = 56
const SET_ROWS_VISIBLE = 3

function SetsList({
  exercise,
  completedSets,
  skippedSets,
  currentSetIdx,
  formOverrides,
  onGoToSet,
}: SetsListProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const sets = exercise.sets ?? []
  const scrollRef = React.useRef<ScrollView>(null)

  // Auto-scroll so the active row is visible whenever it changes (or whenever
  // the exercise changes — `sets.length` reset triggers a re-scroll to top).
  React.useEffect(() => {
    const ref = scrollRef.current
    if (!ref) return
    // Snap the active row to the top of the visible window when there are
    // more rows than fit. For early rows the scrollTo clamps to 0 internally.
    const targetY = Math.max(0, currentSetIdx * SET_ROW_HEIGHT)
    ref.scrollTo({ y: targetY, animated: true })
  }, [currentSetIdx, sets.length])

  return (
    <ScrollView
      ref={scrollRef}
      style={{ maxHeight: SET_ROW_HEIGHT * SET_ROWS_VISIBLE }}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {sets.map((plannedSet, si) => {
        const isDone = completedSets.includes(si)
        const isSkipped = skippedSets.includes(si)
        const isActive = si === currentSetIdx && !isDone && !isSkipped
        const logged = formOverrides[si]
        const isBodyweight = (plannedSet.weightKg ?? 0) === 0

        const leftColor = isDone
          ? colors.gold
          : isSkipped
            ? colors.label3
            : colors.label2

        return (
          <Pressable
            key={si}
            onPress={() => {
              if (!isDone && !isSkipped) onGoToSet(si)
            }}
            style={[
              setsListStyles.row,
              si < sets.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.sep2,
              },
              { opacity: isActive ? 1 : 0.72 },
            ]}
          >
            {/* Badge */}
            <View
              style={[
                setsListStyles.badge,
                isDone
                  ? { backgroundColor: colors.goldBg, borderColor: colors.gold }
                  : isSkipped
                    ? { backgroundColor: colors.fill, borderColor: colors.sep }
                    : {
                        backgroundColor: colors.fill,
                        borderColor: isActive ? colors.gold : colors.sep,
                      },
              ]}
            >
              <Text
                style={[
                  setsListStyles.badgeText,
                  { color: leftColor },
                ]}
              >
                {isDone ? '✓' : isSkipped ? '↷' : String(si + 1)}
              </Text>
            </View>

            {/* Label + active chip */}
            <View style={setsListStyles.labelWrap}>
              <Text style={[setsListStyles.setLabel, { color: colors.label }]}>
                {t('training.live.setLabel')} {si + 1}
              </Text>
              {isActive && (
                <View style={[setsListStyles.activeChip, { backgroundColor: colors.goldBg }]}>
                  <Text style={[setsListStyles.activeChipText, { color: colors.gold }]}>
                    {t('training.live.setActive')}
                  </Text>
                </View>
              )}
            </View>

            {/* Right: actual or planned */}
            <View style={setsListStyles.rightWrap}>
              {isDone && logged ? (
                <Text style={[setsListStyles.actualText, { color: colors.gold }]}>
                  {logged.reps ?? plannedSet.reps} ×{' '}
                  {isBodyweight
                    ? t('training.live.bw')
                    : `${logged.weightKg ?? plannedSet.weightKg ?? 0} kg`}
                </Text>
              ) : isSkipped ? (
                <Text style={[setsListStyles.skippedText, { color: colors.label3 }]}>
                  {t('training.live.setSkipped')}
                </Text>
              ) : (
                <>
                  <Text style={[setsListStyles.plannedText, { color: colors.label2 }]}>
                    {plannedSet.reps} ×{' '}
                    {isBodyweight ? t('training.live.bw') : `${plannedSet.weightKg ?? 0} kg`}
                  </Text>
                  <Text style={[setsListStyles.planHintText, { color: colors.label3 }]}>
                    {t('training.live.planHint')}
                  </Text>
                </>
              )}
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const setsListStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setLabel: {
    fontSize: 13,
  },
  activeChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
  },
  activeChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rightWrap: {
    alignItems: 'flex-end',
  },
  actualText: {
    fontSize: 14,
    fontWeight: '700',
  },
  skippedText: {
    fontSize: 13,
  },
  plannedText: {
    fontSize: 13,
  },
  planHintText: {
    fontSize: 10,
    marginTop: 1,
  },
})

// ─── Styles for the AMRAP-specific exercise list rows ────────────────────────
// `labelStack` swaps `setsListStyles.labelWrap`'s row orientation for column
// so the exercise name + "Hotovo N× · M opak." summary stack vertically in
// the middle column of each row.
const amrapListStyles = StyleSheet.create({
  labelStack: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 2,
  },
  exerciseSummary: {
    fontSize: 11,
  },
})

// ─── Workout-plan list (exercise queue for standard sections) ────────────────
//
// Flat per-set queue: each exercise contributes one row per planned set, so
// a 3-set exercise shows up three times consecutively. The active row is
// the (currentExerciseIdx, currentSetIdx) pair; rows before it are marked
// done with a checkmark badge. Tapping a row jumps to that exact set.

interface ExerciseQueueProps {
  /** Exercises in the active section, in queue order. */
  exercises: SessionExercise[]
  /** Section-relative index of the active exercise. */
  currentRelativeIdx: number
  /** Set index within the active exercise. */
  currentSetIdx: number
  /**
   * Actual reps/weight logged per set, keyed by exerciseExternalId then setIdx.
   * Mirrors the liveSessionStore formOverrides shape. Used to show edited values
   * on finished rows instead of the original planned prescription.
   */
  formOverrides: Record<string, Record<number, { reps?: number; weightKg?: number }>>
  /** Tap handler — section-relative exercise index + set index. */
  onGoToSet: (exRelIdx: number, setIdx: number) => void
}

function ExerciseQueue({
  exercises,
  currentRelativeIdx,
  currentSetIdx,
  formOverrides,
  onGoToSet,
}: ExerciseQueueProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const scrollRef = React.useRef<ScrollView>(null)
  const scrollYRef = React.useRef(0)
  const viewportHRef = React.useRef(SET_ROW_HEIGHT * 6.2)

  // Flatten (exercise, set) pairs into a single queue. Memo not needed —
  // the cost is trivial and the parent already re-renders only on state
  // changes that would alter the queue anyway.
  const rows: Array<{
    key: string
    exRelIdx: number
    setIdx: number
    exerciseExternalId: string
    exerciseName: string
    reps: number
    weightKg: number
    globalPosition: number
  }> = []
  let position = 0
  exercises.forEach((ex, exRelIdx) => {
    const sets = ex.sets ?? []
    const exId = ex.exerciseExternalId ?? `ex-${exRelIdx}`
    sets.forEach((set, setIdx) => {
      position += 1
      rows.push({
        key: `${exId}-${setIdx}`,
        exRelIdx,
        setIdx,
        exerciseExternalId: exId,
        exerciseName: ex.exerciseName ?? `#${exRelIdx + 1}`,
        reps: set.reps ?? 0,
        weightKg: set.weightKg ?? 0,
        globalPosition: position,
      })
    })
  })

  // Auto-scroll only when the active (exercise, set) row is outside the
  // viewport — same row-leave trigger as RoundsList, so the eye does the
  // tracking and the list doesn't jump on every set change.
  const activeRowIdx = rows.findIndex(
    (r) => r.exRelIdx === currentRelativeIdx && r.setIdx === currentSetIdx,
  )
  React.useEffect(() => {
    const ref = scrollRef.current
    if (!ref || activeRowIdx < 0) return
    const rowTop = activeRowIdx * SET_ROW_HEIGHT
    const rowBottom = rowTop + SET_ROW_HEIGHT
    const viewTop = scrollYRef.current
    const viewBottom = viewTop + viewportHRef.current
    if (rowTop >= viewTop && rowBottom <= viewBottom) return
    const targetY =
      rowTop < viewTop
        ? rowTop
        : Math.max(0, rowBottom - viewportHRef.current)
    ref.scrollTo({ y: targetY, animated: true })
  }, [activeRowIdx])

  return (
    <ScrollView
      ref={scrollRef}
      // Cap at exactly 5 rows. Each row's real layout height (~50 px:
      // paddingVertical 12 × 2 + badge 26) is slightly smaller than the
      // generic SET_ROW_HEIGHT constant used by SetsList/RoundsList scroll
      // math, so the cap uses a tighter multiplier (4.5) to land on 5
      // visible rows without a half-row peek. Internal scroll handles the
      // overflow; the system scroll indicator shows transiently on touch.
      style={{ maxHeight: SET_ROW_HEIGHT * 4.5 }}
      nestedScrollEnabled
      showsVerticalScrollIndicator
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y
        viewportHRef.current = e.nativeEvent.layoutMeasurement.height
      }}
      scrollEventThrottle={64}
    >
      {rows.map((row, i) => {
        const isActive =
          row.exRelIdx === currentRelativeIdx && row.setIdx === currentSetIdx
        const isDone =
          row.exRelIdx < currentRelativeIdx ||
          (row.exRelIdx === currentRelativeIdx && row.setIdx < currentSetIdx)
        const isBodyweight = row.weightKg === 0
        const badgeColor = isDone || isActive ? colors.gold : colors.label2
        // Look up the client's edited actuals for finished rows, mirroring
        // SetsList: formOverrides[exerciseExternalId]?.[setIdx].
        const logged = isDone ? formOverrides[row.exerciseExternalId]?.[row.setIdx] : undefined

        return (
          <Pressable
            key={row.key}
            onPress={() => onGoToSet(row.exRelIdx, row.setIdx)}
            style={[
              setsListStyles.row,
              i < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.sep2,
              },
              { opacity: isDone || isActive ? 1 : 0.72 },
            ]}
          >
            {/* Badge — global queue position, or checkmark when complete. */}
            <View
              style={[
                setsListStyles.badge,
                isDone
                  ? { backgroundColor: colors.goldBg, borderColor: colors.gold }
                  : isActive
                    ? { backgroundColor: colors.fill, borderColor: colors.gold }
                    : { backgroundColor: colors.fill, borderColor: colors.sep },
              ]}
            >
              <Text style={[setsListStyles.badgeText, { color: badgeColor }]}>
                {isDone ? '✓' : String(row.globalPosition)}
              </Text>
            </View>

            {/* Exercise name. No AKTUÁLNÍ chip — the badge's gold-ring +
                filled state plus the row's full opacity (inactive rows are
                dimmed to 0.72) already make the active row read clearly,
                and the chip would compete with the right-meta on long
                exercise names. */}
            <View style={setsListStyles.labelWrap}>
              <Text
                style={[
                  setsListStyles.setLabel,
                  { color: colors.label, fontWeight: isActive ? '600' : '400' },
                ]}
                numberOfLines={1}
              >
                {row.exerciseName}
              </Text>
            </View>

            {/* Right: actual values (gold) for done rows, planned for the rest. */}
            <View style={setsListStyles.rightWrap}>
              {isDone ? (
                <Text style={[setsListStyles.actualText, { color: colors.gold }]}>
                  {(logged?.reps ?? row.reps)} ×{' '}
                  {isBodyweight
                    ? t('training.live.bw')
                    : `${logged?.weightKg ?? row.weightKg} kg`}
                </Text>
              ) : (
                <Text style={[setsListStyles.plannedText, { color: colors.label2 }]}>
                  {row.reps} ×{' '}
                  {isBodyweight ? t('training.live.bw') : `${row.weightKg} kg`}
                </Text>
              )}
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

// ─── Rounds-list section (WOD formats with rounds: EMOM, Tabata) ─────────────

interface RoundsListProps {
  /** All exercises in the current WOD section. */
  sectionExercises: SessionExercise[]
  /** Total number of rounds in the WOD config. */
  totalRounds: number
  /** Currently active round (1-based; 0 → not yet started). */
  currentRound: number
}

function RoundsList({ sectionExercises, totalRounds, currentRound }: RoundsListProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const scrollRef = React.useRef<ScrollView>(null)
  // Track the latest scroll offset + viewport height so we can decide
  // whether the active round is already on-screen. Refs (not state) so
  // updating them on every onScroll tick doesn't trigger re-renders.
  const scrollYRef = React.useRef(0)
  const viewportHRef = React.useRef(SET_ROW_HEIGHT * 4.9)

  // Auto-scroll only when the active round row would be outside the visible
  // viewport. If the user can already see the active row, leave the scroll
  // position alone — the eye does the tracking, no jarring jump on every
  // round change.
  React.useEffect(() => {
    const ref = scrollRef.current
    if (!ref || currentRound < 1) return
    const rowTop = (currentRound - 1) * SET_ROW_HEIGHT
    const rowBottom = rowTop + SET_ROW_HEIGHT
    const viewTop = scrollYRef.current
    const viewBottom = viewTop + viewportHRef.current
    if (rowTop >= viewTop && rowBottom <= viewBottom) {
      // Already on-screen — no scroll.
      return
    }
    // Bring the row into view: snap to top if scrolling up, align to
    // bottom if scrolling down past the visible window.
    const targetY =
      rowTop < viewTop
        ? rowTop
        : Math.max(0, rowBottom - viewportHRef.current)
    ref.scrollTo({ y: targetY, animated: true })
  }, [currentRound])

  return (
    <ScrollView
      ref={scrollRef}
      // Cap at ~4.9 rows so the list doesn't dominate the screen. When the
      // workout has more rounds the inner ScrollView scrolls and the system
      // scroll indicator shows transiently on touch. Auto-scroll keeps the
      // active round in view only when it would otherwise scroll off-screen.
      style={{ maxHeight: SET_ROW_HEIGHT * 4.9 }}
      nestedScrollEnabled
      showsVerticalScrollIndicator
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y
        viewportHRef.current = e.nativeEvent.layoutMeasurement.height
      }}
      scrollEventThrottle={64}
    >
      {Array.from({ length: totalRounds }, (_, i) => {
        const roundNumber = i + 1
        // Exercise rotates through the section exercises list each round.
        const exercise = sectionExercises[(i) % sectionExercises.length]
        const firstSet = exercise?.sets?.[0]

        const isDone = currentRound > roundNumber
        const isActive = currentRound === roundNumber

        const badgeColor = isDone
          ? colors.gold
          : isActive
            ? colors.gold
            : colors.label2

        return (
          <View
            key={roundNumber}
            style={[
              setsListStyles.row,
              i < totalRounds - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.sep2,
              },
              { opacity: isActive || isDone ? 1 : 0.72 },
            ]}
          >
            {/* Badge */}
            <View
              style={[
                setsListStyles.badge,
                isDone
                  ? { backgroundColor: colors.goldBg, borderColor: colors.gold }
                  : isActive
                    ? { backgroundColor: colors.fill, borderColor: colors.gold }
                    : { backgroundColor: colors.fill, borderColor: colors.sep },
              ]}
            >
              <Text style={[setsListStyles.badgeText, { color: badgeColor }]}>
                {isDone ? '✓' : String(roundNumber)}
              </Text>
            </View>

            {/* Label — no AKTUÁLNÍ chip; the badge's gold-ring fill plus
                the row's full opacity (inactive rows dimmed to 0.72) and
                the active row's font-weight bump already make the active
                round read clearly. */}
            <View style={setsListStyles.labelWrap}>
              <Text
                style={[
                  setsListStyles.setLabel,
                  {
                    color: colors.label,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
                numberOfLines={1}
              >
                {exercise?.exerciseName ?? `#${roundNumber}`}
              </Text>
            </View>

            {/* Right: prescription summary — uses the shared formatter so
                Time, Distance, RepsForTime all render correctly (the
                older `${reps} × ${weight} kg` template silently dropped
                duration/distance fields). `isWod=true` so the helper
                drops the `{setCount}×` prefix (a WOD exercise stores a
                single row that holds the round prescription). */}
            <View style={setsListStyles.rightWrap}>
              {firstSet != null && exercise != null ? (
                <Text style={[setsListStyles.plannedText, { color: colors.label2 }]}>
                  {formatExerciseSummary(
                    exercise.sets ?? [],
                    exercise.movementType,
                    true,
                  )}
                </Text>
              ) : null}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

// ─── Exercise roadmap pills ───────────────────────────────────────────────────

interface RoadmapPillsProps {
  exercises: SessionExercise[]
  currentExerciseIdx: number
  completedSets: Record<string, number[]>
  onGoToExercise: (idx: number) => void
  /** WOD round mode (EMOM / Tabata): pills show per-exercise round progress
      `<doneRoundsForExercise>/<totalRoundsForExercise>` and the active pill
      tracks the current round's exercise (rotating through `exercises`),
      not `currentExerciseIdx` (which doesn't tick with rounds). */
  wodMode?: boolean
  /** Current active round (1-based) when in `wodMode`. */
  currentRound?: number
  /** Total rounds in the section's WOD config. */
  totalRounds?: number
  /** AMRAP mode: progress bar reflects elapsed/time-cap, pills show
      "{reps} reps" per exercise, no active/full pill highlights (all
      exercises are available throughout the AMRAP window). */
  amrapMode?: boolean
  /** Seconds elapsed in the AMRAP timer (parent state). */
  amrapElapsedSeconds?: number
  /** Total time cap in seconds for the AMRAP timer. */
  amrapTimeCapSeconds?: number
  /** ForTime mode (with per-exercise `durationSeconds`): each pill
   *  represents one exercise's time slot. Progress bar tracks
   *  cumulative elapsed / total prescribed duration. */
  forTimeMode?: boolean
  /** 0-based active exercise idx; equals `exercises.length` once every
   *  slot has elapsed (all done). */
  forTimeActiveIdx?: number
  /** Sum of every exercise's prescribed `durationSeconds`. */
  forTimeTotalDuration?: number
  /** Cumulative elapsed seconds since the workout started (excludes prep). */
  forTimeElapsedSeconds?: number
}

function RoadmapPills({
  exercises,
  currentExerciseIdx,
  completedSets,
  onGoToExercise,
  wodMode,
  currentRound,
  totalRounds,
  amrapMode,
  amrapElapsedSeconds,
  amrapTimeCapSeconds,
  forTimeMode,
  forTimeActiveIdx,
  forTimeTotalDuration,
  forTimeElapsedSeconds,
}: RoadmapPillsProps) {
  const colors = useTheme()

  // Round-based progress (WOD mode) — each round is one "unit", rotating
  // through the section's exercises. Round counter is 1-based; rounds
  // strictly less than `currentRound` are considered done.
  const numEx = exercises.length
  const wodCurrent = currentRound ?? 0
  const wodTotal = totalRounds ?? 0

  // Total done across all exercises (set-mode) or rounds (wod-mode).
  const totalDone = useMemo(() => {
    if (wodMode) return Math.max(0, Math.min(wodTotal, wodCurrent - 1))
    let n = 0
    for (const sets of Object.values(completedSets)) n += sets.length
    return n
  }, [wodMode, wodCurrent, wodTotal, completedSets])

  const totalSets = useMemo(() => {
    if (wodMode) return wodTotal
    return exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0)
  }, [wodMode, wodTotal, exercises])

  // AMRAP progress bar tracks elapsed-time / time-cap; ForTime (with
  // per-exercise durations) tracks cumulative-elapsed / total-prescribed-
  // duration; WOD + standard fall back to the round / set ratio.
  const pct = amrapMode
    ? amrapTimeCapSeconds && amrapTimeCapSeconds > 0
      ? Math.min(1, (amrapElapsedSeconds ?? 0) / amrapTimeCapSeconds)
      : 0
    : forTimeMode && forTimeTotalDuration && forTimeTotalDuration > 0
      ? Math.min(1, (forTimeElapsedSeconds ?? 0) / forTimeTotalDuration)
      : totalSets > 0
        ? totalDone / totalSets
        : 0

  // Round → exercise index mapping (round r belongs to exercise (r-1) % numEx).
  // No "active" pill once every round is done (wodCurrent > wodTotal). The
  // pills then all flip to the `isFull` green styling instead of leaving
  // one stuck in the gold-active state.
  const wodActiveIdx =
    wodMode && numEx > 0 && wodCurrent >= 1 && wodCurrent <= wodTotal
      ? (wodCurrent - 1) % numEx
      : -1

  return (
    <View
      style={[
        roadmapStyles.wrap,
        { backgroundColor: colors.bg, borderBottomColor: colors.sep2 },
      ]}
    >
      {/* Overall progress bar */}
      <View style={[roadmapStyles.track, { backgroundColor: colors.fill }]}>
        <View
          style={[
            roadmapStyles.fill,
            { backgroundColor: colors.gold, width: `${Math.round(pct * 100)}%` },
          ]}
        />
      </View>

      {/* Exercise pills */}
      <View style={roadmapStyles.pills}>
        {exercises.map((ex, i) => {
          const exId = ex.exerciseExternalId ?? `ex-${i}`
          // WOD mode: count the rounds in [1..wodTotal] that map to this
          // exercise index (i), and how many of those rounds have already
          // been completed (round < currentRound). Set-mode: fall back to
          // tracked completed sets vs planned sets.
          let done: number
          let total: number
          if (wodMode && numEx > 0) {
            total =
              i < wodTotal ? Math.floor((wodTotal - 1 - i) / numEx) + 1 : 0
            const completedRounds = Math.max(0, wodCurrent - 1)
            done =
              i < completedRounds
                ? Math.floor((completedRounds - 1 - i) / numEx) + 1
                : 0
          } else if (forTimeMode) {
            // ForTime time-based mode: each pill is a single time slot
            // (one "unit"); slots strictly before the active one are
            // marked done.
            total = 1
            done = (forTimeActiveIdx ?? 0) > i ? 1 : 0
          } else {
            done = completedSets[exId]?.length ?? 0
            total = ex.sets?.length ?? 0
          }
          // AMRAP: no active/full highlights — all exercises are available
          // throughout the time cap. The pill stays neutral; meta shows the
          // prescribed reps-per-round instead of done/total.
          const isActive = amrapMode
            ? false
            : wodMode
              ? i === wodActiveIdx
              : forTimeMode
                ? i === forTimeActiveIdx
                : i === currentExerciseIdx
          const isFull = !amrapMode && done === total && total > 0
          const amrapReps = amrapMode ? (ex.sets?.[0]?.reps ?? 0) : 0

          return (
            <Pressable
              key={i}
              onPress={() => onGoToExercise(i)}
              style={[
                roadmapStyles.pill,
                { backgroundColor: colors.fill2, borderColor: 'transparent' },
                isActive && {
                  backgroundColor: colors.goldBg,
                  borderColor: colors.gold,
                },
                isFull && {
                  backgroundColor: colors.green + '14',
                  borderColor: colors.green + '59',
                },
              ]}
            >
              <Text
                style={[
                  roadmapStyles.pillName,
                  { color: colors.label2 },
                  isActive && { color: colors.gold },
                  isFull && { color: colors.green },
                ]}
                numberOfLines={1}
              >
                {ex.exerciseName?.split(' ')[0] ?? `#${i + 1}`}
              </Text>
              <Text style={[roadmapStyles.pillMeta, { color: colors.label3 }]}>
                {amrapMode ? `${amrapReps} reps` : `${done}/${total}`}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const roadmapStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  track: {
    height: 3,
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
  },
  pills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  pill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  pillName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.02 * 11,
  },
  pillMeta: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
})

// ─── Pre-start state ──────────────────────────────────────────────────────────

interface PreStartProps {
  sessionName: string
  sections: TrainingSection[]
  exerciseMuscleGroups: Record<string, MuscleGroup[]>
  onStart: () => void
}

function PreStart({ sessionName, sections, exerciseMuscleGroups, onStart }: PreStartProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  // Per-section expand/collapse state — collapsed by default on pre-start
  // (matches Today's collapsed behaviour). The summary card above shows
  // session totals; the user can expand any workout if they want to peek
  // the per-exercise prescription before tapping Start.
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      sections.map((s, i) => [s.sectionId ?? `section-${i}`, false])
    )
  )

  const handleToggleSection = useCallback((sectionKey: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))
  }, [])

  // Derive total exercise count from sections
  const totalExercises = sections.flatMap((s) => s.exercises ?? []).length

  // Section-based summary (mirrors TrainingCard.tsx lines ~340-358)
  const sectionDurations = sections.map((sec) =>
    estimatedSectionDurationSeconds(sec.format, sec.formatConfig),
  )
  const timedSeconds = sectionDurations.reduce<number>((sum, d) => sum + (d ?? 0), 0)
  const untimedCount = sectionDurations.filter((d) => d == null || d === 0).length
  const summaryParts: string[] = [
    t('training.workoutCount', { count: sections.length }),
    t('training.exerciseCount', { count: totalExercises }),
  ]
  if (timedSeconds > 0) summaryParts.push(formatDurationCompact(timedSeconds))
  if (timedSeconds > 0 && untimedCount > 0) {
    summaryParts.push(t('training.workoutUntimedCount', { count: untimedCount }))
  }
  const sessionSummary = summaryParts.join(' · ')

  // First upcoming workout subtitle — built from sections[0] so the user sees
  // what they're about to start without scrolling to the workouts list below.
  // Format: "<workout name>" for Standard workouts, or
  //         "<workout name> · <duration>" for WOD-format workouts.
  const firstSection = sections[0]
  const firstSectionIsWod =
    firstSection?.format != null && firstSection.format !== 'Standard'
  const firstSectionDuration = firstSection
    ? estimatedSectionDurationSeconds(firstSection.format, firstSection.formatConfig)
    : null
  const firstWorkoutSummaryParts: string[] = []
  if (firstSection?.name) firstWorkoutSummaryParts.push(firstSection.name)
  if (firstSectionIsWod && firstSectionDuration != null && firstSectionDuration > 0) {
    firstWorkoutSummaryParts.push(formatDurationCompact(firstSectionDuration))
  }
  const firstWorkoutSummary = firstWorkoutSummaryParts.join(' · ')

  return (
    <View style={preStyles.root}>
      {/* Hero card — dark heroBg with just the session name. The
          "Začínáte: …" subtitle was removed; the next-workout context is
          available in the workouts list below. */}
      <View style={[preStyles.heroCard, { backgroundColor: colors.heroBg }]}>
        <View style={preStyles.heroBody}>
          <Text style={preStyles.heroName}>
            {sessionName.split('·').slice(-1)[0].trim()}
          </Text>
        </View>
      </View>

      {/* Session summary card — same stats-bar layout as the workout
          summary page: equal-flex cells separated by vertical hairlines,
          gold tabular-num value on top, uppercase dim label beneath. */}
      {(() => {
        const cells: Array<{ value: string; label: string }> = [
          {
            value: String(sections.length),
            label: t('training.live.workoutsLabel'),
          },
        ]
        if (timedSeconds > 0) {
          cells.push({
            value: formatDurationCompact(timedSeconds),
            label: t('training.live.statTime'),
          })
        }
        // Third cell only when there's at least one untimed workout — gives
        // the user a heads-up that some workouts in the session don't
        // contribute to the total time (Standard / open-ended).
        if (untimedCount > 0) {
          cells.push({
            value: String(untimedCount),
            label: t('training.live.untimedWorkoutsLabel'),
          })
        }
        return (
          <View
            style={[
              preStyles.summaryCard,
              { backgroundColor: colors.bg2, borderColor: colors.sep2 },
            ]}
          >
            {cells.map((cell, idx) => (
              <View
                key={cell.label}
                style={[
                  preStyles.summaryCell,
                  idx > 0 && {
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderLeftColor: colors.sep2,
                  },
                ]}
              >
                <Text style={[preStyles.summaryValue, { color: colors.gold }]}>
                  {cell.value}
                </Text>
                <Text style={[preStyles.summaryLabel, { color: colors.label3 }]}>
                  {cell.label}
                </Text>
              </View>
            ))}
          </View>
        )
      })()}

      {/* Workouts list — header sits fixed; the card itself scrolls
          INTERNALLY (flex:1 + ScrollView below) so the hero + summary
          card above stay anchored when expanded workouts overflow. */}
      <View style={preStyles.listHeader}>
        <Text style={[preStyles.listHeaderText, { color: colors.label2 }]}>
          {t('training.live.todayWorkouts')}
        </Text>
      </View>
      <ScrollView
        style={preStyles.listScroll}
        contentContainerStyle={preStyles.listScrollContent}
        showsVerticalScrollIndicator
      >
      <View style={[preStyles.listCard, { backgroundColor: colors.bg2 }]}>
        {sections.map((sec, sectionIdx) => {
          const sectionKey = sec.sectionId ?? `section-${sectionIdx}`
          const sectionExercises = sec.exercises ?? []
          const hasExercises = sectionExercises.length > 0
          const sectionIsWod = sec.format != null && sec.format !== 'Standard'
          // Collapsed by default on pre-start — the user can expand any
          // workout to peek before tapping Start.
          const isExpanded = hasExercises && (expandedSections[sectionKey] ?? false)
          const isLastSection = sectionIdx === sections.length - 1
          const sectionDuration = estimatedSectionDurationSeconds(sec.format, sec.formatConfig)

          return (
            <View
              key={sectionKey}
              style={[
                preStyles.sectionWrap,
                isLastSection
                  ? { borderBottomWidth: 0 }
                  : { borderBottomColor: colors.sep2 },
              ]}
            >
              <SectionHeader
                name={sec.name ?? t('training.section.defaultName')}
                format={sec.format}
                formatConfig={sec.formatConfig}
                durationSeconds={sectionDuration}
                exerciseCount={sectionExercises.length}
                notes={sec.notes}
                isExpanded={isExpanded}
                onToggleExpanded={() => handleToggleSection(sectionKey)}
                // Pre-start is read-only — no completion checkbox.
                // Omitting isSectionComplete keeps showCompleteBtn false in SectionHeader.
                nonExpandable={!hasExercises}
                suppressBottomDivider={!isExpanded}
              />

              <AnimatedCollapse expanded={isExpanded}>
                {sectionExercises.map((exercise, exIdx) => {
                  const exId = exercise.exerciseExternalId ?? null
                  const sets = exercise.sets ?? []

                  // Movement-type-aware summary via the shared helper —
                  // same string the Today card, plan-detail, and trainer
                  // portal render.
                  const exSummary = formatExerciseSummary(
                    sets,
                    exercise.movementType,
                    sectionIsWod,
                  )

                  // Dot color: first muscle group, fall back to brand gold.
                  const exMuscleGroups = exId != null ? (exerciseMuscleGroups[exId] ?? []) : []
                  const primaryMg = exMuscleGroups[0]
                  const dotColor = primaryMg != null
                    ? getMuscleGroupColor(primaryMg, colors)
                    : colors.gold

                  return (
                    <ExpandableExerciseCard
                      key={exId ?? exIdx}
                      name={exercise.exerciseName ?? ''}
                      summaryText={exSummary}
                      dotColor={dotColor}
                      // Pre-start: nothing is completed yet.
                      isCompleted={false}
                      defaultExpanded={false}
                      nested
                      nestedFirst={exIdx === 0}
                      // Pre-start: all formats are read-only — always hide
                      // the completion indicator (no sets done yet).
                      hideCompletionIndicator
                      // WOD prescription is in the section header — no detail
                      // to drill into for individual exercises.
                      nonExpandable={sectionIsWod}
                      notes={exercise.notes}
                      // No onToggle — read-only pre-start state.
                    >
                      {/* SetGrid without completedSetNumbers — nothing done yet */}
                      <SetGrid sets={sets} />
                    </ExpandableExerciseCard>
                  )
                })}
              </AnimatedCollapse>
            </View>
          )
        })}
      </View>
      </ScrollView>

      {/* Start session button is rendered OUTSIDE this component, pinned
          to the bottom of the screen — see the pre-start CTA wrapper in
          [id].tsx (the page-level render). */}
    </View>
  )
}

const preStyles = StyleSheet.create({
  // PreStart root — flex:1 so the inner workouts ScrollView can claim the
  // remaining vertical space below the hero + summary cards.
  root: {
    flex: 1,
  },
  // Internal scroll wrapper for the workouts list — keeps hero + summary
  // pinned above; the user scrolls workouts in-place.
  listScroll: {
    flex: 1,
  },
  listScrollContent: {
    paddingBottom: 16,
  },
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  heroBody: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 20,
    lineHeight: 18,
  },
  heroMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  // Session-summary stats bar — matches the section-finished page's stats
  // card: equal-flex cells (workouts · exercises · duration) with vertical
  // hairline dividers between them. Top margin matches `listHeader.paddingTop`
  // below so the visual gap above the summary equals the gap to the workouts
  // card beneath it.
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 2,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.04 * 10,
    textAlign: 'center',
  },
  // Pinned-style start button at the bottom — large gold tappable CTA,
  // mirrors the section-finished "Pokračovat na další workout" button.
  bottomStartBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  listHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 13,
  },
  listCard: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  // Each section row inside the listCard — hairline divider below, suppressed on last.
  sectionWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})

// ─── Section finished interstitial ───────────────────────────────────────────

interface SectionFinishedExerciseRow {
  /** Exercise name shown as the row's title. */
  name: string
  /**
   * One entry per planned set, carrying its set number, the actual (or
   * planned-fallback) reps + weight, and a `done` flag identifying whether
   * the user actually completed it. The stats card only counts sets with
   * `done === true` — skipping the workout before completing anything must
   * report 0/0/0, not the prescribed plan.
   */
  sets: {
    setNumber: number
    reps: number | null
    weightKg: number | null
    done: boolean
  }[]
  /**
   * Planned sets from the session's exercise prescription.
   * Passed directly to SetGrid as the `sets` prop so it can render set
   * numbers, rest times, and the planned-value captions for treatment B.
   */
  plannedSets: ExerciseSet[]
  /** 1-based set numbers that the user actually completed. */
  completedSetNumbers: number[]
  /** 1-based set numbers that the user skipped (↷). */
  skippedSetNumbers: number[]
  /**
   * Actual vs. snapshot-planned set data built client-side from formOverrides
   * (#441/#468). Passed to SetGrid to enable treatment B: actual headline +
   * "plán X" caption + gold change-dot when the user edited a value.
   */
  loggedSets: LoggedSetDto[]
}

/**
 * Collapse an exercise's logged sets into a single one-line summary:
 *
 *   "3 × 10 · 50 kg"             — all sets identical
 *   "3 × 8-10 · 50 kg"           — varied reps, same weight
 *   "3 × 10 · 40-50 kg"          — same reps, varied weight (pyramid)
 *   "3 × 8-10 · 40-50 kg"        — both vary
 *   "3 × 10 · BW"                — bodyweight only
 *
 * Returns null when there are no sets with any rep data (purely skipped
 * exercise) so the meta line can be omitted entirely.
 */
function summarizeExerciseSets(
  sets: SectionFinishedExerciseRow['sets'],
  t: (key: string) => string,
): string | null {
  // Consider only sets the user actually finished. An exercise with zero
  // completed sets returns null so the meta line is hidden entirely.
  const doneSets = sets.filter((s) => s.done)
  if (doneSets.length === 0) return null
  const reps = doneSets.map((s) => s.reps).filter((r): r is number => r != null && r > 0)
  if (reps.length === 0) return null
  const weights = doneSets.map((s) => s.weightKg ?? 0)

  const setCount = doneSets.length
  const minR = Math.min(...reps)
  const maxR = Math.max(...reps)
  const repsPart =
    minR === maxR ? `${setCount}×${minR}` : `${setCount}×${minR}-${maxR}`

  const allBW = weights.every((w) => w === 0)
  if (allBW) return `${repsPart} · ${t('training.live.bw')}`

  // Only consider non-zero weights for the range so a mixed BW/loaded
  // exercise still reports the loaded range cleanly.
  const loaded = weights.filter((w) => w > 0)
  const minW = Math.min(...loaded)
  const maxW = Math.max(...loaded)
  const weightPart = minW === maxW ? `${minW} kg` : `${minW}-${maxW} kg`
  return `${repsPart} · ${weightPart}`
}

interface SectionFinishedNextWorkout {
  /** Display name of the upcoming workout (section). */
  name: string
  /** WOD format, or null for Standard. */
  format: WorkoutFormat | null
  /** Total exercises in the upcoming workout. */
  exerciseCount: number
  /** Estimated wall-clock duration in seconds (Standard → null). */
  estimatedDurationSeconds: number | null
  /** Round count for WOD formats with rounds (EMOM / Tabata / ForTime). */
  totalRounds: number | null
}

interface SectionFinishedScreenProps {
  /** Duration of the just-finished workout. Standard-only — null for WODs. */
  durationSeconds: number | null
  exerciseSummaries: SectionFinishedExerciseRow[]
  /** Section format — drives stat-card content. `null` / `'Standard'` →
      sets / reps / volume. WOD formats use round-based stats. */
  sectionFormat?: WorkoutFormat | null
  /** Total rounds defined for the section's WOD config. */
  totalRounds?: number | null
  /** WodResult captured at finalise time (rounds completed, failed, etc.). */
  wodResult?: WodResult | null
}

function SectionFinishedScreen({
  durationSeconds,
  exerciseSummaries,
  sectionFormat,
  totalRounds,
  wodResult,
}: SectionFinishedScreenProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const isWodSection = sectionFormat != null && sectionFormat !== 'Standard'

  // Roll up the per-exercise summary into top-line stats (standard mode).
  // Only sets actually marked done contribute — the stats card must report
  // real work, not the prescribed plan. Bodyweight sets count toward total
  // reps but contribute zero volume.
  let totalSets = 0
  let totalReps = 0
  let totalVolume = 0
  if (!isWodSection) {
    for (const ex of exerciseSummaries) {
      for (const s of ex.sets) {
        if (!s.done) continue
        const reps = s.reps ?? 0
        const weight = s.weightKg ?? 0
        if (reps > 0) {
          totalSets += 1
          totalReps += reps
          totalVolume += reps * weight
        }
      }
    }
  } else {
    // WOD mode: aggregate from rounds and the section's exercise prescriptions.
    // Each round maps to one exercise via rotation: exercise index (r-1) % N.
    const numEx = exerciseSummaries.length
    const roundsDone = wodResult?.roundsCompleted ?? 0
    if (numEx > 0 && roundsDone > 0) {
      for (let r = 1; r <= roundsDone; r++) {
        const exIdx = (r - 1) % numEx
        const ex = exerciseSummaries[exIdx]
        const firstSet = ex?.sets?.[0]
        const reps = firstSet?.reps ?? 0
        const weight = firstSet?.weightKg ?? 0
        if (reps > 0) {
          totalReps += reps
          totalVolume += reps * weight
        }
      }
      // For AMRAP, surplus extra reps (set via the stepper) add to total reps
      // but contribute zero to the volume aggregation (we don't know which
      // exercise they belonged to).
      if (sectionFormat === 'AMRAP' && wodResult?.extraReps) {
        totalReps += wodResult.extraReps
      }
      // For Tabata, repsByRound may carry per-round reps if the user logged them.
      if (sectionFormat === 'Tabata' && wodResult?.repsByRound) {
        const summed = wodResult.repsByRound.reduce<number>(
          (sum, r) => sum + (r ?? 0),
          0,
        )
        // Prefer the user-logged total when it's non-zero.
        if (summed > 0) totalReps = summed
      }
    }
  }

  // Stats cells — content branches on format:
  //   Standard → SÉRIÍ · OPAKOVÁNÍ · OBJEM (KG)?
  //   AMRAP     → KOL · OPAKOVÁNÍ · BONUSOVÉ OPAK.?
  //   EMOM      → KOL · OPAKOVÁNÍ · NEÚSPĚŠNÝCH?
  //   Tabata    → KOL · OPAKOVÁNÍ · BONUSOVÉ OPAK.?
  //   ForTime   → KOL? (or just no stats card — duration is on the hero)
  const statCells: Array<{ value: string; label: string }> = []
  if (!isWodSection) {
    statCells.push(
      { value: String(totalSets), label: t('training.live.summaryTotalSets') },
      { value: String(totalReps), label: t('training.live.summaryTotalReps') },
    )
    if (totalVolume > 0) {
      statCells.push({
        value: String(totalVolume),
        label: `${t('training.live.summaryTotalVolume')} (kg)`,
      })
    }
  } else {
    const roundsDone = wodResult?.roundsCompleted ?? 0
    const totalRoundsLabel =
      totalRounds && totalRounds > 0
        ? `${roundsDone} / ${totalRounds}`
        : String(roundsDone)
    statCells.push({
      value: totalRoundsLabel,
      label: t('training.live.summaryRoundsDone'),
    })
    if (totalReps > 0) {
      statCells.push({
        value: String(totalReps),
        label: t('training.live.summaryTotalReps'),
      })
    }
    // EMOM tracks failed rounds; AMRAP / Tabata track explicit extra reps.
    if (sectionFormat === 'EMOM' && (wodResult?.failedRounds?.length ?? 0) > 0) {
      statCells.push({
        value: String(wodResult!.failedRounds!.length),
        label: t('training.live.summaryRoundsFailed'),
      })
    } else if (
      (sectionFormat === 'AMRAP' || sectionFormat === 'Tabata') &&
      (wodResult?.extraReps ?? 0) > 0
    ) {
      statCells.push({
        value: String(wodResult!.extraReps),
        label: t('training.live.summaryExtraReps'),
      })
    }
  }

  return (
    <View style={sectionFinishedStyles.root}>
      {/* ── Dark hero card — checkmark + "Hotovo!" + workout duration ── */}
      <View style={[sectionFinishedStyles.card, { backgroundColor: colors.heroBg, borderColor: colors.sep2 }]}>
        <View style={[sectionFinishedStyles.iconCircle, { backgroundColor: colors.goldBg }]}>
          <Text style={[sectionFinishedStyles.iconText, { color: colors.gold }]}>✓</Text>
        </View>
        <Text style={[sectionFinishedStyles.title, { color: colors.onAccent }]}>
          {t('training.live.sectionFinishedTitle')}
        </Text>
        {durationSeconds != null && (
          <Text
            style={[
              sectionFinishedStyles.subtitle,
              { color: colors.onAccent, opacity: 0.7 },
            ]}
          >
            {formatDurationCompact(durationSeconds)}
          </Text>
        )}
      </View>

      {/* ── Stats card — total sets / reps / volume rolled up from the
          per-exercise summary, in its own bordered card so it visually
          separates from the exercise list below. Variable cell count:
          volume column dropped on bodyweight-only workouts. ── */}
      {exerciseSummaries.length > 0 && (
        <View
          style={[
            sectionFinishedStyles.statsCard,
            { backgroundColor: colors.bg2, borderColor: colors.sep2 },
          ]}
        >
          {statCells.map((cell, idx) => (
            <View
              key={cell.label}
              style={[
                sectionFinishedStyles.statCell,
                idx > 0 && {
                  borderLeftWidth: StyleSheet.hairlineWidth,
                  borderLeftColor: colors.sep2,
                },
              ]}
            >
              <Text style={[sectionFinishedStyles.statValue, { color: colors.gold }]}>
                {cell.value}
              </Text>
              <Text style={[sectionFinishedStyles.statLabel, { color: colors.label3 }]}>
                {cell.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Per-exercise summary card — fills the remaining vertical space.
          When the exercise list overflows the available card height the
          user can scroll just the list (the surrounding hero / stats /
          next-workout cards stay anchored). ── */}
      {exerciseSummaries.length > 0 && (
        <View
          style={[
            sectionFinishedStyles.summaryCard,
            { backgroundColor: colors.bg2, borderColor: colors.sep2 },
          ]}
        >
          <ScrollView
            style={sectionFinishedStyles.summaryListScroll}
            contentContainerStyle={sectionFinishedStyles.summaryListContent}
            showsVerticalScrollIndicator
          >
            {exerciseSummaries.map((ex, exIdx) => (
              <View
                key={`${exIdx}-${ex.name}`}
                style={[
                  sectionFinishedStyles.summaryExerciseBlock,
                  exIdx < exerciseSummaries.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.sep2,
                  },
                ]}
              >
                <Text
                  style={[sectionFinishedStyles.summaryExerciseName, { color: colors.label }]}
                  numberOfLines={1}
                >
                  {ex.name}
                </Text>
                {/* Treatment B: actual headline + "plán X" caption + gold dot
                    when the user edited a value, matching LiveFinishedSummary
                    (#468). SetGrid renders one row per planned set so skipped
                    sets show '↷' and completed sets show the actual value. */}
                <SetGrid
                  sets={ex.plannedSets}
                  completedSetNumbers={ex.completedSetNumbers}
                  skippedSetNumbers={ex.skippedSetNumbers}
                  loggedSets={ex.loggedSets}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Next-workout preview card is rendered separately in the pinned
          bottom slot (above the "Pokračovat" CTA), not inside the summary
          view — see `NextWorkoutPreviewCard` usage at the call site. */}
    </View>
  )
}

/** Bordered preview card for the upcoming workout — sits in the pinned
 *  bottom slot above the gold CTA so the user can see what they're about
 *  to start while their thumb hovers over the button. */
function NextWorkoutPreviewCard({
  nextWorkout,
}: {
  nextWorkout: SectionFinishedNextWorkout
}) {
  const colors = useTheme()
  const { t } = useTranslation()
  return (
    <View
      style={[
        sectionFinishedStyles.nextCard,
        { backgroundColor: colors.bg2, borderColor: colors.sep2 },
      ]}
    >
      <Text style={[sectionFinishedStyles.nextEyebrow, { color: colors.label3 }]}>
        {t('training.live.nextWorkoutEyebrow')}
      </Text>
      <View style={sectionFinishedStyles.nextHeaderRow}>
        <Text
          style={[sectionFinishedStyles.nextName, { color: colors.label }]}
          numberOfLines={1}
        >
          {nextWorkout.name}
        </Text>
        {nextWorkout.format != null && nextWorkout.format !== 'Standard' && (
          <View
            style={[
              sectionFinishedStyles.formatChip,
              { backgroundColor: colors.goldBg },
            ]}
          >
            <Text style={[sectionFinishedStyles.formatChipText, { color: colors.gold }]}>
              {nextWorkout.format.toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={sectionFinishedStyles.nextMetaRow}>
        <Text style={[sectionFinishedStyles.nextMetaItem, { color: colors.label2 }]}>
          {t('training.live.exerciseCountShort', { count: nextWorkout.exerciseCount })}
        </Text>
        {nextWorkout.totalRounds != null && (
          <>
            <Text style={[sectionFinishedStyles.nextMetaDot, { color: colors.label3 }]}>
              ·
            </Text>
            <Text style={[sectionFinishedStyles.nextMetaItem, { color: colors.label2 }]}>
              {t('training.live.roundsCount', { count: nextWorkout.totalRounds })}
            </Text>
          </>
        )}
        {nextWorkout.estimatedDurationSeconds != null && (
          <>
            <Text style={[sectionFinishedStyles.nextMetaDot, { color: colors.label3 }]}>
              ·
            </Text>
            <Text style={[sectionFinishedStyles.nextMetaItem, { color: colors.label2 }]}>
              {formatDurationCompact(nextWorkout.estimatedDurationSeconds)}
            </Text>
          </>
        )}
      </View>
    </View>
  )
}

const sectionFinishedStyles = StyleSheet.create({
  // Outer fixed wrapper that replaces the ScrollView during sectionFinished —
  // takes flex:1 of the remaining viewport between header / roadmap pills
  // and the pinned CTA. Inner Animated.View also stretches so the cards
  // can use the available height.
  fixedWrap: {
    flex: 1,
  },
  fixedAnimated: {
    flex: 1,
  },
  root: {
    flex: 1,
    // Match the pinned-bottom wrap (`pinnedCtaWrap` uses paddingHorizontal:
    // 16) so the hero / stats / summary cards align with the next-workout
    // card edges. Drop the bottom padding to 0 — the pinned wrap's own
    // paddingTop already provides the gap between summary card and the
    // next-workout card, and equalising removes the visual offset
    // between "above the next-workout card" and "below" it.
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 0,
    gap: 12,
  },
  // Dark hero — checkmark + "Hotovo!" + duration, centered stacked layout
  // matching the previous look. Sits at the top of the freed middle area.
  card: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '700',
  },
  title: {
    ...Type.title3,
    textAlign: 'center',
  },
  // Soft-white subtitle under "Hotovo!" — carries the workout duration.
  subtitle: {
    ...Type.headline,
    textAlign: 'center',
    marginTop: 4,
  },
  summaryCard: {
    width: '100%',
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  // Inner scrollable list of per-exercise rows. Takes flex:1 of the card's
  // remaining height (after the fixed stats strip above it).
  summaryListScroll: {
    flex: 1,
  },
  summaryListContent: {
    paddingBottom: 4,
  },
  // Stats card — own bordered card with three equal-flex cells separated
  // by vertical hairline dividers. Tabular-num gold value over a dim
  // caption, explicit center text alignment so optical centering is exact.
  statsCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.04 * 10,
    textAlign: 'center',
  },
  summaryExerciseBlock: {
    paddingVertical: 12,
  },
  summaryExerciseName: {
    ...Type.headline,
  },
  // One-line "N×reps · weight" meta below the exercise name. Tabular-num so
  // the row stays vertically aligned across exercises.
  summaryExerciseMeta: {
    ...Type.subheadline,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  // Next-workout preview card — rendered in the pinned bottom slot
  // (`pinnedNextCardWrap` in the page-level styles handles the spacing
  // between the card and the gold CTA below).
  nextCard: {
    width: '100%',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nextEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
    marginBottom: 4,
  },
  nextHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nextName: {
    ...Type.title3,
    flex: 1,
    minWidth: 0,
  },
  formatChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  formatChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.04 * 11,
  },
  nextMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  nextMetaItem: {
    fontSize: 13,
  },
  nextMetaDot: {
    fontSize: 13,
    marginHorizontal: 6,
  },
  nextHint: {
    ...Type.footnote,
    textAlign: 'center',
  },
  startBtn: {
    width: '100%',
    borderRadius: Radius.sm,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnText: {
    ...Type.callout,
    fontWeight: '600',
  },
})

// ─── Main screen ──────────────────────────────────────────────────────────────

/**
 * Screen params:
 *   id        — workoutLog id, or "new" to start a fresh log
 *   planId    — (optional) when starting fresh
 *   sessionId — (optional) when starting fresh
 */
export default function WorkoutLogScreen() {
  const { id, planId, sessionId } = useLocalSearchParams<{
    id: string
    planId?: string
    sessionId?: string
  }>()
  const router = useRouter()
  const { t } = useTranslation()
  const colors = useTheme()
  const isConnected = useNetworkStatus()
  const queryClient = useQueryClient()

  // ── Live session store ──
  const store = useLiveSessionStore()
  const {
    activeLogId,
    currentExerciseIdx,
    currentSetIdx,
    currentSectionIdx,
    completedSets,
    skippedSets,
    skippedExercises,
    restStartedAt,
    restSeconds,
    startedAt,
    finishedAt,
    formOverrides,
    wodResults,
    start: storeStart,
    markSetDone: storeMarkSetDone,
    skipSet: storeSkipSet,
    skipExercise: storeSkipExercise,
    startRest: storeStartRest,
    skipRest: storeSkipRest,
    advance: storeAdvance,
    advanceSection: storeAdvanceSection,
    close: storeClose,
    finish: storeFinish,
    discard: storeDiscard,
    finalizeWod: storeFinalizeWod,
  } = store

  // ── Phase: prestart | running | sectionFinished | finished ──
  const [phase, setPhase] = useState<'prestart' | 'running' | 'sectionFinished' | 'finished'>(() => {
    // Fresh-start route (`/training-session/new`) always begins on the
    // pre-start screen — the previous session's persisted `finishedAt`
    // would otherwise land the user on the OLD finished summary every
    // time they start a new workout. The startNew effect below clears
    // the stale store state in parallel.
    if (id === 'new') return 'prestart'

    // Restore phase from persisted store state for an existing log id.
    if (activeLogId !== null && finishedAt !== null) return 'finished'
    if (activeLogId !== null && finishedAt === null) return 'running'
    return 'prestart'
  })

  // ── Section start timestamps (keyed by sectionIdx, stores ms epoch) ──
  const sectionStartTimestampsRef = useRef<Map<number, number>>(new Map())

  // ── Finished section info (populated before entering sectionFinished phase) ──
  const [finishedSectionInfo, setFinishedSectionInfo] = useState<{
    sectionIdx: number
    durationSeconds: number | null
  } | null>(null)

  // ── Session exercises (from API) ──
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [sections, setSections] = useState<TrainingSection[]>([])
  const [exerciseMuscleGroups, setExerciseMuscleGroups] = useState<
    Record<string, MuscleGroup[]>
  >({})
  const [sessionDisplayName, setSessionDisplayName] = useState('')
  const [loadedLogId, setLoadedLogId] = useState<string | null>(
    // Fresh-start route → no inherited log id; the startNew effect will
    // call startWorkout and stash the freshly-issued id via setLoadedLogId.
    id === 'new' ? null : (id ?? activeLogId ?? null),
  )
  // ── WOD session-level format info ──
  const [sessionFormat, setSessionFormat] = useState<WorkoutFormat | null>(null)
  const [sessionFormatConfig, setSessionFormatConfig] = useState<WodConfig | null>(null)
  // showWodHero removed (#338) — the overlay render site that consumed this
  // state was a duplicate of the inline Sites #1 and #2. Dead state cleaned up.
  // showSectionRunner was removed — inter-section state now uses phase === 'sectionFinished'

  /**
   * Current round reported by the running WodTimerHero (EMOM / Tabata).
   * 1-based; 1 when not yet started so the first RoundsList row is highlighted.
   * Updated via the onRoundChange callback threaded through WodTimerHero.
   */
  const [currentWodRound, setCurrentWodRound] = useState(1)

  /**
   * Seconds elapsed in the running AmrapTimer / ForTime timer. Threaded
   * up via the `WodTimerHero.onElapsedChange` callback so the roadmap-pills
   * progress bar can render a time-based fill (instead of round/set count).
   */
  const [amrapElapsed, setAmrapElapsed] = useState(0)
  /**
   * Rounds completed in the running AmrapTimer. Threaded via
   * `WodTimerHero.onRoundsChange` so the AMRAP exercise list can show a
   * per-exercise "Hotovo N× · M opak." summary line.
   */
  const [amrapRounds, setAmrapRounds] = useState(0)

  /**
   * ForTime-with-timed-exercises progression: when the active section is
   * ForTime AND every exercise carries a `durationSeconds`, derive which
   * exercise the cumulative elapsed time has reached. Drives the
   * RoadmapPills active/done state AND the in-card ForTime exercise list
   * highlighting so the user sees auto-advance as the timer ticks past
   * each exercise's slot.
   *
   * `activeIdx` semantics:
   *   - 0..N-1 → that exercise is currently in its time slot
   *   - N       → every exercise has elapsed (workout complete by time)
   *
   * Returns `null` when the section isn't ForTime, has no exercises, or
   * none of them carry a duration (classic "race to finish" ForTime
   * keeps its original behaviour — no auto-advance).
   */
  const forTimeProgress = useMemo(() => {
    const activeSec = sections[currentSectionIdx ?? 0]
    const fmt = activeSec?.format ?? null
    if (fmt !== 'ForTime') return null
    const exs = activeSec?.exercises ?? []
    if (exs.length === 0) return null
    const durations = exs.map((ex) => ex.sets?.[0]?.durationSeconds ?? 0)
    const totalDuration = durations.reduce((a, b) => a + b, 0)
    if (totalDuration === 0) return null
    let cum = 0
    let activeIdx = exs.length // default = all done
    for (let i = 0; i < durations.length; i++) {
      cum += durations[i]
      if (amrapElapsed < cum) {
        activeIdx = i
        break
      }
    }
    return { activeIdx, totalDuration, elapsed: amrapElapsed }
  }, [sections, currentSectionIdx, amrapElapsed])

  // ── Local form state (reps / weight steppers) ──
  const [formReps, setFormReps] = useState(0)
  const [formWeight, setFormWeight] = useState(0)

  // ── PR flash ──
  const [prVisible, setPrVisible] = useState(false)
  const prCountRef = useRef(0)

  // ── Confirm sheet ──

  // ── goLive in-flight guard ──
  // ── Elapsed timer (local interval, drives display only) ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Mutations ──
  const updateMutation = useMutation({
    mutationFn: ({ logId, req }: { logId: string; req: UpdateWorkoutWodRequest }) =>
      updateWorkout(logId, req as UpdateWorkoutRequest),
    onError: (_err, vars) => {
      if (!isConnected) {
        addPendingMutation({
          method: 'PUT',
          url: `/client/training/logs/${vars.logId}`,
          data: vars.req,
        })
      }
    },
  })

  const completeMutation = useMutation({
    // Invalidation lives inside mutationFn (not onSuccess) so it runs even when
    // the screen has already unmounted. The LiveFinishedSummary → handleBackToToday
    // path navigates away before the POST resolves on slow networks, causing the
    // observer-level onSuccess callback to be silently dropped by TanStack Query v5.
    mutationFn: async (logId: string) => {
      const result = await completeWorkout(logId)
      // Invalidate personal records so the profile card refreshes on next view.
      void queryClient.invalidateQueries({ queryKey: ['personal-records-latest'] })
      // Refresh the Today card so completed exercises / sessions light up there too.
      void queryClient.invalidateQueries({ queryKey: ['today-training'] })
      void queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
      return result
    },
    onError: (_err, logId) => {
      if (!isConnected) {
        addPendingMutation({
          method: 'POST',
          url: `/client/training/logs/${logId}/complete`,
        })
      }
    },
  })

  // ── Load session exercises on mount ──
  // When multiple sessions are planned for today, the sessionId route param
  // tells us which one the user picked on the Today card. Fall back to the
  // first session if no id was passed (e.g. legacy deep links).
  useEffect(() => {
    async function load() {
      try {
        const resp = await getTodaySession()
        const sessionList = resp.sessions ?? []
        const rawSession =
          (sessionId && sessionList.find((s) => s.sessionId === sessionId)) ||
          sessionList[0]
        if (!rawSession) return
        // Cast to WOD-aware type (sections + format fields)
        const session = rawSession as unknown as WodAwareSession
        setSessionDisplayName(session.name ?? '')
        setExercises(session.exercises ?? [])
        setExerciseMuscleGroups(resp.exerciseMuscleGroups ?? {})
        // Capture session-level WOD format
        const fmt = session.format ?? null
        setSessionFormat(fmt)
        setSessionFormatConfig(session.formatConfig ?? null)
        // Load sections (falls back to single default section for flat plans)
        const effectiveSections = getEffectiveSections(session, t)
        setSections(effectiveSections)
        // (showWodHero removed in #338 — overlay was a duplicate of inline render sites)

        // Restore the section-finished interstitial if the user backgrounded
        // the screen while sitting on it. The phase state isn't persisted —
        // re-derive it from the live store: when every exercise in the
        // current section has all its sets in completedSets / skippedSets
        // (or the exercise itself is in skippedExercises), and there's
        // another section after it, the user was on the workout summary.
        const liveState = useLiveSessionStore.getState()
        if (
          liveState.activeLogId !== null &&
          liveState.finishedAt === null &&
          effectiveSections.length > 1
        ) {
          const secIdx = liveState.currentSectionIdx ?? 0
          const sec = effectiveSections[secIdx]
          const hasNextSection = secIdx + 1 < effectiveSections.length
          if (sec && hasNextSection) {
            const secExercises = sec.exercises ?? []
            // WOD sections (AMRAP / EMOM / Tabata / ForTime) don't fill
            // `completedSets` — they get finalised via `storeFinalizeWod`,
            // which writes the section's WodResult to `wodResults`. If a
            // result is present for this section the WOD has already wrapped,
            // so the user was on the summary screen when they left.
            const sectionId = sec.sectionId ?? null
            const wodResult = sectionId ? liveState.wodResults[sectionId] : null
            const isWodFinished = wodResult != null

            const isStandardComplete =
              secExercises.length > 0 &&
              secExercises.every((ex) => {
                const exId = ex.exerciseExternalId ?? ''
                const totalSets = ex.sets?.length ?? 0
                if (totalSets === 0) return true
                if (liveState.skippedExercises.includes(exId)) return true
                const done = liveState.completedSets[exId] ?? []
                const skipped = liveState.skippedSets[exId] ?? []
                return done.length + skipped.length >= totalSets
              })

            if (isWodFinished || isStandardComplete) {
              // Duration recovery: WOD results carry totalTimeSeconds so we
              // can show "Hotovo · X min" again. Standard sections lose the
              // wall-clock duration on remount (section-start timestamps
              // aren't persisted) — `SectionFinishedScreen` handles null.
              const durationSeconds = isWodFinished
                ? wodResult?.totalTimeSeconds ?? null
                : null
              setFinishedSectionInfo({ sectionIdx: secIdx, durationSeconds })
              setPhase('sectionFinished')
            }
          }
        }
      } catch {
        // Non-fatal — screen still works with empty exercises in pre-start
      }
    }
    void load()
  }, [sessionId])

  // ── Start fresh workout (id === "new") ──
  useEffect(() => {
    if (id !== 'new') return
    // Wipe any persisted store state left over from the previous session
    // (finishedAt, completedSets, currentExerciseIdx, etc.) so the new
    // session opens on a clean slate. `storeStart` will repopulate the
    // session metadata once the user taps "Start" on the pre-start screen.
    storeDiscard()
    async function startNew() {
      try {
        const resp = await startWorkout({
          planId: planId ?? undefined,
          sessionId: sessionId ?? undefined,
        })
        const newLogId = resp.logId ?? null
        if (newLogId) setLoadedLogId(newLogId)
      } catch (err) {
        // AC (b): 409 with Problem Details errorCode "session_locked" → toast, not
        // generic alert. The backend writes the code into ProblemDetails.Extensions
        // under the verbatim key "errorCode" (camelCase). The banner is a cosmetic
        // warning; the 409 is the authoritative gate — a trainer finished editing
        // between banner render and tap.
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 409 &&
          (err.response.data as { errorCode?: string } | undefined)?.errorCode === 'session_locked'
        ) {
          Toast.show(t('training.sessionEditing.startBlockedToast'))
          return
        }
        Alert.alert(t('common.error'), t('training.startError'))
      }
    }
    void startNew()
  }, [id, planId, sessionId, t, storeDiscard])

  // ── Prefill form when exercise/set changes ──
  const prefillForm = useCallback(
    (exIdx: number, setIdx: number, exerciseList: SessionExercise[]) => {
      const ex = exerciseList[exIdx]
      if (!ex) return
      const exId = ex.exerciseExternalId ?? `ex-${exIdx}`
      const existingOverride = formOverrides[exId]?.[setIdx]
      if (existingOverride) {
        setFormReps(existingOverride.reps ?? ex.sets?.[setIdx]?.reps ?? 0)
        setFormWeight(existingOverride.weightKg ?? ex.sets?.[setIdx]?.weightKg ?? 0)
      } else {
        setFormReps(ex.sets?.[setIdx]?.reps ?? 0)
        setFormWeight(ex.sets?.[setIdx]?.weightKg ?? 0)
      }
    },
    [formOverrides],
  )

  useEffect(() => {
    if (phase === 'running') {
      prefillForm(currentExerciseIdx, currentSetIdx, exercises)
    }
  }, [phase, currentExerciseIdx, currentSetIdx, exercises, prefillForm])

  // ── Elapsed timer ──
  useEffect(() => {
    // Keep ticking during BOTH 'running' and 'sectionFinished' — the timer
    // in the header represents the whole session's elapsed time, and the
    // user is still mid-session while reviewing a workout's summary.
    if ((phase === 'running' || phase === 'sectionFinished') && startedAt) {
      // Recompute from wall clock on every tick
      const tick = () => {
        setElapsedSeconds(Math.round((Date.now() - Date.parse(startedAt)) / 1000))
      }
      tick()
      elapsedIntervalRef.current = setInterval(tick, 1000)
    } else {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
      if (phase === 'finished' && startedAt && finishedAt) {
        setElapsedSeconds(
          Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000),
        )
      }
    }
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current)
        elapsedIntervalRef.current = null
      }
    }
  }, [phase, startedAt, finishedAt])

  // ── Build UpdateWorkoutRequest from store state ──
  // Read straight from the Zustand store via `getState()` rather than the
  // destructured render-time snapshot. Callers like `handleSetDone` mutate
  // the store *then* call `persistUpdate()` within the same event tick —
  // before React re-renders and this callback's closure is rebuilt. Using
  // `getState()` guarantees the PUT body reflects the freshly-marked set
  // instead of the pre-mutation snapshot (which would persist N-1 sets).
  const buildRequest = useCallback((): UpdateWorkoutWodRequest => {
    const state = useLiveSessionStore.getState()
    const exerciseList: UpdateWodExerciseRequest[] = exercises.map((ex) => {
      const exId = ex.exerciseExternalId ?? ''
      const doneSetIndices = state.completedSets[exId] ?? []
      const skippedSetIndices = state.skippedSets[exId] ?? []
      const sets = (ex.sets ?? []).map((planned, si) => {
        const override = state.formOverrides[exId]?.[si]
        const isDone = doneSetIndices.includes(si)
        const isSkipped = skippedSetIndices.includes(si)
        // `planned.setNumber` from the plan is already 1-based; fall back to
        // `si + 1` only when the plan entry doesn't carry it. Previously this
        // was `(planned.setNumber ?? si) + 1`, which double-incremented
        // real plan set numbers (1,2,3 → 2,3,4) and left the WorkoutLog
        // misaligned with the plan.
        return {
          setNumber: planned.setNumber ?? si + 1,
          reps: isDone ? (override?.reps ?? planned.reps) : undefined,
          weightKg: isDone ? (override?.weightKg ?? planned.weightKg) : undefined,
          // Time-movement actuals: durationSeconds replaces the reps slot.
          // Use undefined (not null) to match UpdateWorkoutSetRequest's field type.
          durationSeconds: isDone ? (override?.durationSeconds ?? undefined) : undefined,
          // Distance-movement actuals: distanceMeters replaces the weightKg slot.
          distanceMeters: isDone ? (override?.distanceMeters ?? undefined) : undefined,
          // Only truly completed sets carry completedAt. Skipped sets must NOT
          // receive a completedAt timestamp — the backend (GetTodaySession)
          // uses CompletedAt != null to populate completedSetsBySessionExercise,
          // so sending completedAt for skipped sets caused them to show as '✓'
          // on the Today-screen TrainingCard SetGrid (bug #322).
          completedAt: isDone ? new Date().toISOString() : undefined,
          // Snapshot-planned values (#441): the backend stores these on the
          // WorkoutLog so the isModified flag can be computed on read. Send
          // the original plan values from the exercise's planned sets.
          // Use undefined (not null) to match UpdateWorkoutSetRequest's field type.
          plannedReps: planned.reps ?? undefined,
          plannedWeightKg: planned.weightKg ?? undefined,
          plannedRpe: planned.rpe ?? undefined,
          plannedDurationSeconds: planned.durationSeconds ?? undefined,
          plannedDistanceMeters: planned.distanceMeters ?? undefined,
        }
      })
      // Per-exercise WOD result (only present when the exercise has a format override).
      const exWodResult = state.wodResults[exId] ?? null
      return {
        exerciseExternalId: exId,
        exerciseName: ex.exerciseName ?? '',
        sets,
        wodResult: exWodResult ?? undefined,
      }
    })
    // Section-level WOD result: use the current (or first) section's sectionId as the key.
    // If there are multiple sections, only the active section's WOD result is sent as the
    // top-level wodResult. Per-exercise results are already in exerciseList entries.
    const activeSectionId = sections[currentSectionIdx ?? 0]?.sectionId ?? null
    const sectionWodResult = activeSectionId != null
      ? (state.wodResults[activeSectionId] ?? null)
      : null
    return {
      exercises: exerciseList,
      wodResult: sectionWodResult ?? undefined,
    }
  }, [exercises, sections, currentSectionIdx])

  const persistUpdate = useCallback(() => {
    const logId = loadedLogId ?? activeLogId
    if (!logId) return
    const req = buildRequest()
    updateMutation.mutate({ logId, req })
  }, [loadedLogId, activeLogId, buildRequest, updateMutation])

  // ── Helpers: compute next position ──
  function computeNext(
    exIdx: number,
    setIdx: number,
    exerciseList: SessionExercise[],
  ): { nextExIdx: number; nextSetIdx: number; isLast: boolean } {
    const ex = exerciseList[exIdx]
    const isLastSet = setIdx >= (ex?.sets?.length ?? 1) - 1
    const isLastEx = exIdx >= exerciseList.length - 1

    if (isLastSet && isLastEx) {
      return { nextExIdx: exIdx, nextSetIdx: setIdx, isLast: true }
    }
    if (isLastSet) {
      return { nextExIdx: exIdx + 1, nextSetIdx: 0, isLast: false }
    }
    return { nextExIdx: exIdx, nextSetIdx: setIdx + 1, isLast: false }
  }

  // ── Actions ──

  // Sequences the final WorkoutLog write then the complete flip.
  // `UpdateWorkoutEndpoint` filters `IsCompleted = false`, so if
  // `completeMutation` lands first the last-set PUT 404s and that set is
  // lost from the log — the Today card then re-reads WorkoutLog and the
  // final set shows as unfinished. Awaiting update before firing complete
  // guarantees the log carries the final set before the flip.
  const finalizeWorkout = useCallback(
    async (logId: string) => {
      try {
        const req = buildRequest()
        await updateMutation.mutateAsync({ logId, req })
      } catch {
        // Offline path is handled inside updateMutation.onError; proceed anyway.
      }
      completeMutation.mutate(logId)
    },
    [buildRequest, updateMutation, completeMutation],
  )

  const handleStart = useCallback(() => {
    const logId = loadedLogId ?? activeLogId
    if (!sessionId) {
      console.warn('[handleStart] sessionId is empty — route param may be malformed')
    }
    storeStart({ sessionId: sessionId ?? '' }, logId ?? '', planId ?? '')
    // Pin section index to 0 explicitly so the header's `currentSectionIdx`
    // is never null on the running phase — null was relied on through the
    // ?? 0 fallback, but downstream consumers (the workout-name + workout
    // counter in LiveSessionHeader) compared the persisted store value
    // against null which made the header lag a render behind on the very
    // first workout. Setting it explicitly keeps everything consistent.
    storeAdvanceSection(0)
    // Stamp the first section's start time
    sectionStartTimestampsRef.current.set(0, Date.now())
    setPhase('running')

    // When sessions have sections, start with the first section's exercises
    const firstSection = sections[0]
    if (firstSection) {
      const resolved = resolveSection(firstSection, sessionFormat, sessionFormatConfig)
      const firstSectionExercises = resolved.exercises
      // Update the active exercise list to the first section's exercises
      setExercises(firstSectionExercises)
      prefillForm(0, 0, firstSectionExercises)
      // (showWodHero removed in #338)
    } else {
      prefillForm(0, 0, exercises)
      // (showWodHero removed in #338)
    }

    // Acquire the Live lock now that the user has explicitly started.
    // The draft log was created on mount (startNew effect) — this is the
    // second step that broadcasts state=Live to trainers. Best-effort:
    // a 409 (session_locked) surfaces as a toast; other errors are logged.
    if (logId) {
      goLive(logId).catch((err: unknown) => {
        if (
          axios.isAxiosError(err) &&
          err.response?.status === 409 &&
          (err.response.data as { errorCode?: string } | undefined)?.errorCode === 'session_locked'
        ) {
          Toast.show(t('training.sessionEditing.startBlockedToast'))
        } else {
          console.warn('[handleStart] goLive failed', err)
        }
      })
    }
  }, [storeStart, storeAdvanceSection, loadedLogId, activeLogId, exercises, sections, sessionId, planId, prefillForm, sessionFormat, sessionFormatConfig, t])

  const handleSetDone = useCallback(() => {
    const ex = exercises[currentExerciseIdx]
    if (!ex) return
    const exId = ex.exerciseExternalId ?? `ex-${currentExerciseIdx}`
    const actuals = { reps: formReps, weightKg: formWeight }

    // PR detection — check before recording
    const prFired = isPR(formOverrides, exId, formWeight)
    if (prFired) {
      prCountRef.current += 1
      setPrVisible(true)
    }

    storeMarkSetDone(exId, currentSetIdx, actuals)

    const { nextExIdx, nextSetIdx, isLast } = computeNext(
      currentExerciseIdx,
      currentSetIdx,
      exercises,
    )

    if (isLast) {
      // Last set of last exercise in this section — check for more sections
      const nextSectionIdx = (currentSectionIdx ?? 0) + 1
      if (nextSectionIdx < sections.length) {
        // More sections remain — persist, stash summary, show interstitial
        const finishedIdx = currentSectionIdx ?? 0
        const finishedSec = sections[finishedIdx]
        const startTs = sectionStartTimestampsRef.current.get(finishedIdx) ?? Date.now()
        const isStandard = finishedSec?.format == null || finishedSec.format === 'Standard'
        const durationSeconds = isStandard ? Math.round((Date.now() - startTs) / 1000) : null
        setFinishedSectionInfo({ sectionIdx: finishedIdx, durationSeconds })
        persistUpdate()
        setPhase('sectionFinished')
      } else {
        // No more sections — finish session
        storeFinish()
        setPhase('finished')
        const logId = loadedLogId ?? activeLogId
        if (logId) void finalizeWorkout(logId)
      }
      return
    }

    // Start rest timer
    const restSecs = ex.restSeconds ?? ex.sets?.[currentSetIdx]?.restSeconds ?? 60
    storeStartRest(restSecs)
    // Persist to backend
    persistUpdate()
    // The rest overlay will call handleSkipRest → advance
    // Store the pending advance target in local state
    pendingAdvanceRef.current = { ex: nextExIdx, set: nextSetIdx }
  }, [
    exercises,
    sections,
    currentSectionIdx,
    currentExerciseIdx,
    currentSetIdx,
    formReps,
    formWeight,
    formOverrides,
    storeMarkSetDone,
    storeFinish,
    storeStartRest,
    loadedLogId,
    activeLogId,
    finalizeWorkout,
    persistUpdate,
  ])

  const pendingAdvanceRef = useRef<{ ex: number; set: number } | null>(null)

  const handleSkipRest = useCallback(() => {
    storeSkipRest()
    const pending = pendingAdvanceRef.current
    if (pending) {
      storeAdvance(pending.ex, pending.set)
      prefillForm(pending.ex, pending.set, exercises)
      pendingAdvanceRef.current = null
    }
  }, [storeSkipRest, storeAdvance, prefillForm, exercises])

  const handleSkipSet = useCallback(() => {
    const ex = exercises[currentExerciseIdx]
    if (!ex) return
    const exId = ex.exerciseExternalId ?? `ex-${currentExerciseIdx}`
    storeSkipSet(exId, currentSetIdx)

    const { nextExIdx, nextSetIdx, isLast } = computeNext(
      currentExerciseIdx,
      currentSetIdx,
      exercises,
    )
    if (isLast) {
      const nextSectionIdx = (currentSectionIdx ?? 0) + 1
      if (nextSectionIdx < sections.length) {
        const finishedIdx = currentSectionIdx ?? 0
        const finishedSec = sections[finishedIdx]
        const startTs = sectionStartTimestampsRef.current.get(finishedIdx) ?? Date.now()
        const isStandard = finishedSec?.format == null || finishedSec.format === 'Standard'
        const durationSeconds = isStandard ? Math.round((Date.now() - startTs) / 1000) : null
        setFinishedSectionInfo({ sectionIdx: finishedIdx, durationSeconds })
        persistUpdate()
        setPhase('sectionFinished')
      } else {
        storeFinish()
        setPhase('finished')
        const logId = loadedLogId ?? activeLogId
        if (logId) void finalizeWorkout(logId)
      }
      return
    }
    storeAdvance(nextExIdx, nextSetIdx)
    prefillForm(nextExIdx, nextSetIdx, exercises)
    persistUpdate()
  }, [
    exercises,
    sections,
    currentSectionIdx,
    currentExerciseIdx,
    currentSetIdx,
    storeSkipSet,
    storeFinish,
    storeAdvance,
    prefillForm,
    loadedLogId,
    activeLogId,
    finalizeWorkout,
    persistUpdate,
  ])

  // Skip the rest of the current workout (section) entirely — jumps straight
  // to the section-finished interstitial as if the workout had just wrapped.
  // The user sees the per-exercise summary and can press the gold CTA to
  // start the next workout (or end the session if this was the last one).
  const handleSkipWorkout = useCallback(() => {
    const finishedIdx = currentSectionIdx ?? 0
    const finishedSec = sections[finishedIdx]
    const startTs =
      sectionStartTimestampsRef.current.get(finishedIdx) ?? Date.now()
    const isStandard =
      finishedSec?.format == null || finishedSec.format === 'Standard'
    const durationSeconds = isStandard
      ? Math.round((Date.now() - startTs) / 1000)
      : null
    setFinishedSectionInfo({ sectionIdx: finishedIdx, durationSeconds })
    persistUpdate()
    setPhase('sectionFinished')
  }, [currentSectionIdx, sections, persistUpdate])

  const handleGoToExercise = useCallback(
    (idx: number) => {
      if (phase !== 'running') return
      storeSkipRest()
      pendingAdvanceRef.current = null
      storeAdvance(idx, 0)
      prefillForm(idx, 0, exercises)
    },
    [phase, storeSkipRest, storeAdvance, prefillForm, exercises],
  )

  const handleGoToSet = useCallback(
    (idx: number) => {
      if (phase !== 'running') return
      storeAdvance(currentExerciseIdx, idx)
      prefillForm(currentExerciseIdx, idx, exercises)
    },
    [phase, currentExerciseIdx, storeAdvance, prefillForm, exercises],
  )

  const exitToToday = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href('/(client)'))
  }, [router])

  const handleClose = useCallback(async () => {
    // Flush the latest store state to the server BEFORE invalidating 'today-training'.
    // The backend's WorkoutLog-merge logic needs the PUT to land first; if we
    // invalidate while the PUT is still in-flight the refetch races ahead of
    // the write and Today shows stale completion data.
    const logId = loadedLogId ?? activeLogId
    if (logId && phase === 'running') {
      try {
        const req = buildRequest()
        await updateMutation.mutateAsync({ logId, req })
      } catch {
        // Offline path is handled inside updateMutation.onError; proceed anyway.
      }
    }
    storeClose()
    // Now that the PUT has landed, a refetch will see the latest WorkoutLog.
    void queryClient.invalidateQueries({ queryKey: ['today-training'] })
    void queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    exitToToday()
  }, [storeClose, exitToToday, queryClient, loadedLogId, activeLogId, phase, buildRequest, updateMutation])

  const handleBackToToday = useCallback(() => {
    storeDiscard()
    void queryClient.invalidateQueries({ queryKey: ['today-training'] })
    void queryClient.invalidateQueries({ queryKey: ['compliance-score'] })
    exitToToday()
  }, [storeDiscard, exitToToday, queryClient])

  // ── WOD finalize ──
  const handleWodFinish = useCallback(
    (sectionId: string, result: WodResult) => {
      storeFinalizeWod(sectionId, result)
      // After WOD hero, check if there are more sections
      const nextSectionIdx = (currentSectionIdx ?? 0) + 1
      if (nextSectionIdx < sections.length) {
        // More sections remain — show interstitial with the WOD's actual
        // elapsed time on the summary hero (each timer now reports
        // `totalTimeSeconds` via WodResult).
        const finishedIdx = currentSectionIdx ?? 0
        setFinishedSectionInfo({
          sectionIdx: finishedIdx,
          durationSeconds: result.totalTimeSeconds ?? null,
        })
        setPhase('sectionFinished')
      } else {
        // All sections done — finish the session
        storeFinish()
        setPhase('finished')
        const logId = loadedLogId ?? activeLogId
        if (logId) void finalizeWorkout(logId)
      }
    },
    [storeFinalizeWod, storeFinish, loadedLogId, activeLogId, finalizeWorkout, currentSectionIdx, sections],
  )

  const handleWodCancel = useCallback(() => {
    // showWodHero removed (#338) — nothing to clear for the overlay any more.
    // Sites #1 and #2 handle their own unmount via phase transitions.
  }, [])

  // ── Derived: total sets done (kept for internal logic) ──
  const totalSetsDone = useMemo(() => {
    let n = 0
    for (const sets of Object.values(completedSets)) n += sets.length
    return n
  }, [completedSets])

  const totalSetsAll = useMemo(
    () => exercises.reduce((n, ex) => n + (ex.sets?.length ?? 0), 0),
    [exercises],
  )

  // ── Derived: workouts done / total (for header label) ──
  // A workout (section) counts as "done" when every trackable exercise in it
  // The header shows position-in-line ("workout 1 / 2") rather than a finished
  // count, so we no longer derive a "workouts done" total here.
  const workoutsTotal = sections.length

  // ── Derived: set statuses for current exercise ──
  const currentExercise = exercises[currentExerciseIdx]
  const currentExId = currentExercise?.exerciseExternalId ?? `ex-${currentExerciseIdx}`

  const setStatuses = useMemo(() => {
    const sets = currentExercise?.sets ?? []
    return sets.map((_, i) => {
      if (completedSets[currentExId]?.includes(i)) return 'done' as const
      if (skippedSets[currentExId]?.includes(i)) return 'skipped' as const
      if (i === currentSetIdx) return 'active' as const
      return 'pending' as const
    })
  }, [currentExercise, currentExId, completedSets, skippedSets, currentSetIdx])

  // ── Derived: rest active ──
  const restActive = restStartedAt !== null && restSeconds !== null

  // ── Derived: finished summary ──
  const finishedSummary = useMemo(() => {
    if (phase !== 'finished' || !startedAt) return null
    const exerciseSummaries: ExerciseSummaryInput[] = exercises.map((ex) => {
      const exId = ex.exerciseExternalId ?? ''
      const doneIndices = completedSets[exId] ?? []
      const doneSets = doneIndices.map((si) => {
        const override = formOverrides[exId]?.[si]
        const planned = ex.sets?.[si]
        return {
          done: true,
          reps: override?.reps ?? planned?.reps ?? 0,
          weightKg: override?.weightKg ?? planned?.weightKg ?? 0,
        }
      })
      return {
        plannedSetCount: ex.sets?.length ?? 0,
        doneSets,
      }
    })
    return computeLiveSummary(
      startedAt,
      finishedAt ?? new Date().toISOString(),
      exerciseSummaries,
      prCountRef.current,
    )
  }, [phase, startedAt, finishedAt, exercises, completedSets, formOverrides])

  // ── Derived: per-workout cards for the session-summary screen ──
  // One card per section: WOD sections pull duration + rounds from the
  // stored WodResult; standard sections derive "N/M sérií · X opak." from
  // completedSets + per-set overrides and include per-exercise SetGrid data
  // so skipped sets render as '↷' instead of blending into '✓' (fix #322).
  const finishedWorkoutCards = useMemo<FinishedWorkoutCardData[]>(() => {
    if (phase !== 'finished') return []
    return sections.map((sec) => {
      const fmt = (sec.format as WorkoutFormat | null) ?? null
      const wodRes = sec.sectionId ? wodResults[sec.sectionId] : null
      if (wodRes != null) {
        const dur =
          wodRes.totalTimeSeconds != null
            ? formatSeconds(wodRes.totalTimeSeconds)
            : null
        const rounds = wodRes.roundsCompleted ?? null
        const meta =
          fmt === 'AMRAP' && rounds != null
            ? t('training.live.roundsCount', { count: rounds })
            : null
        // WOD-format workouts don't have per-set grids.
        return {
          name: sec.name ?? '',
          format: fmt,
          durationFormatted: dur,
          metaText: meta,
          exerciseSets: null,
        }
      }
      // Standard section — count completed vs planned sets across exercises.
      let setsDone = 0
      let setsPlanned = 0
      let totalReps = 0
      const exerciseSets: FinishedExerciseSetData[] = []
      for (const ex of sec.exercises ?? []) {
        const exId = ex.exerciseExternalId ?? ''
        const doneIndices = completedSets[exId] ?? []
        const skippedIndices = skippedExercises.includes(exId)
          // When the whole exercise was skipped, treat every set as skipped.
          ? (ex.sets ?? []).map((_, si) => si)
          : (skippedSets[exId] ?? [])
        setsPlanned += ex.sets?.length ?? 0
        for (const setIdx of doneIndices) {
          setsDone += 1
          const override = formOverrides[exId]?.[setIdx]
          const planned = ex.sets?.[setIdx]
          totalReps += override?.reps ?? planned?.reps ?? 0
        }
        // Build 1-based set-number arrays for SetGrid, deriving the set
        // number from the planned set's own setNumber field (1-based in the
        // plan) so the grid stays aligned even when setNumber !== si + 1.
        const plannedSets = ex.sets ?? []
        const completedSetNums = doneIndices.map(
          (si) => plannedSets[si]?.setNumber ?? si + 1,
        )
        const skippedSetNums = skippedIndices.map(
          (si) => plannedSets[si]?.setNumber ?? si + 1,
        )
        if (plannedSets.length > 0) {
          // Build client-side LoggedSetDto from the live session store (#441).
          // The backend computes isModified server-side (stored in WorkoutLog),
          // but for the local finished summary we derive it from the plan vs
          // the user's actual inputs (formOverrides). This gives immediate
          // visual feedback in the LiveFinishedSummary before the PUT/GET cycle.
          const loggedSets: LoggedSetDto[] = plannedSets.map((planned, si) => {
            const override = formOverrides[exId]?.[si]
            const isDone = doneIndices.includes(si)
            const actualReps = isDone ? (override?.reps ?? planned.reps ?? null) : null
            const actualWeightKg = isDone ? (override?.weightKg ?? planned.weightKg ?? null) : null
            const actualDurationSeconds = isDone ? (override?.durationSeconds ?? null) : null
            const actualDistanceMeters = isDone ? (override?.distanceMeters ?? null) : null
            // isModified: true when the user changed reps or weight vs. plan.
            const repsModified =
              isDone &&
              actualReps != null &&
              planned.reps != null &&
              actualReps !== planned.reps
            const weightModified =
              isDone &&
              actualWeightKg != null &&
              planned.weightKg != null &&
              actualWeightKg !== planned.weightKg
            const durationModified =
              isDone &&
              actualDurationSeconds != null &&
              planned.durationSeconds != null &&
              actualDurationSeconds !== planned.durationSeconds
            return {
              setNumber: planned.setNumber ?? si + 1,
              actualReps: actualReps ?? undefined,
              actualWeightKg: actualWeightKg ?? undefined,
              actualDurationSeconds: actualDurationSeconds ?? undefined,
              actualDistanceMeters: actualDistanceMeters ?? undefined,
              plannedReps: planned.reps ?? undefined,
              plannedWeightKg: planned.weightKg ?? undefined,
              plannedDurationSeconds: planned.durationSeconds ?? undefined,
              plannedDistanceMeters: planned.distanceMeters ?? undefined,
              isModified: repsModified || weightModified || durationModified,
            }
          })
          exerciseSets.push({
            exerciseName: ex.exerciseName ?? '',
            sets: plannedSets,
            completedSetNumbers: completedSetNums,
            skippedSetNumbers: skippedSetNums,
            loggedSets,
          })
        }
      }
      const meta =
        setsPlanned > 0
          ? `${setsDone}/${setsPlanned} ${t('training.live.statSeries').toLowerCase()} · ${totalReps} ${t('training.live.statReps').toLowerCase()}`
          : null
      return {
        name: sec.name ?? '',
        format: fmt,
        durationFormatted: null,
        metaText: meta,
        exerciseSets: exerciseSets.length > 0 ? exerciseSets : null,
      }
    })
  }, [phase, sections, wodResults, completedSets, skippedSets, skippedExercises, formOverrides, t])

  // ── Next preview: usually the next exercise; on the LAST set of the LAST
  //    exercise of the current workout, switch to the next workout (section).
  //    Lets the user see what they're transitioning into rather than a stale
  //    "next exercise" that's actually in the next workout already.
  const nextExerciseRaw = exercises[currentExerciseIdx + 1]
  const activeSecIdx = currentSectionIdx ?? 0
  const activeSection = sections[activeSecIdx]
  // Compute the absolute exercise index range for the active section so we
  // can detect "currentExercise is the last in this section".
  let activeSectionStartIdx = 0
  for (let i = 0; i < activeSecIdx; i++) {
    activeSectionStartIdx += sections[i]?.exercises?.length ?? 0
  }
  const activeSectionExerciseCount = activeSection?.exercises?.length ?? 0
  const activeSectionEndIdx = activeSectionStartIdx + activeSectionExerciseCount - 1
  const isLastExerciseOfSection =
    activeSectionExerciseCount > 0 && currentExerciseIdx === activeSectionEndIdx
  const currentExerciseSetCount = currentExercise?.sets?.length ?? 0
  const isLastSetOfExercise =
    currentExerciseSetCount > 0 && currentSetIdx === currentExerciseSetCount - 1
  const showNextSection = isLastExerciseOfSection && isLastSetOfExercise
  const nextSection = showNextSection ? sections[activeSecIdx + 1] : undefined
  const nextExercise = showNextSection ? undefined : nextExerciseRaw
  const nextSetForRest = pendingAdvanceRef.current
  const nextExerciseForRest = nextSetForRest
    ? exercises[nextSetForRest.ex]
    : nextExercise
  const nextSetIdxForRest = nextSetForRest?.set ?? 0
  const nextPlannedSet = nextExerciseForRest?.sets?.[nextSetIdxForRest]
  const nextSetMeta = nextExerciseForRest
    ? `${t('training.live.setLabel')} ${nextSetIdxForRest + 1} · ${
        (nextPlannedSet?.weightKg ?? 0) > 0
          ? `${nextPlannedSet?.weightKg ?? 0} kg × ${nextPlannedSet?.reps ?? 0}`
          : `BW × ${nextPlannedSet?.reps ?? 0}`
      }`
    : ''

  // ── Render ──
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top']}
    >
      {/* Header — always visible; on prestart the timer reads 00:00 and the
          workout position is 1 / N (the first workout is "current"). */}
      <LiveSessionHeader
        sessionName={sessionDisplayName}
        workoutName={sections[currentSectionIdx ?? 0]?.name ?? ''}
        elapsedSeconds={elapsedSeconds}
        workoutsCurrent={(currentSectionIdx ?? 0) + 1}
        workoutsTotal={workoutsTotal}
        isPreStart={phase === 'prestart'}
        onClose={handleClose}
        closePending={updateMutation.isPending}
      />

      {/* Roadmap — visible only while running. Scoped to the CURRENT workout
          (section) so the user only sees pills for exercises in the workout
          they're in the middle of, not the whole session. Translates between
          the section-relative pill index and the absolute exercise index that
          the rest of the live runner state machine uses. */}
      {phase === 'running' && (() => {
        const activeSecIdx = currentSectionIdx ?? 0
        let sectionStartIdx = 0
        for (let i = 0; i < activeSecIdx; i++) {
          sectionStartIdx += sections[i]?.exercises?.length ?? 0
        }
        const activeSec = sections[activeSecIdx]
        const sectionExercises = activeSec?.exercises ?? []
        const relativeCurrent = currentExerciseIdx - sectionStartIdx

        // WOD context: when the active section is EMOM/Tabata, the pills
        // need to track the current round's exercise (not currentExerciseIdx,
        // which is fixed at the section's first exercise during a WOD run)
        // and show per-exercise round progress instead of set progress.
        const sectionFormat =
          (currentExercise as WodAwareExercise | undefined)?.format ??
          activeSec?.format ??
          null
        const isEmomTabata =
          sectionFormat === 'EMOM' || sectionFormat === 'Tabata'
        const isAmrap = sectionFormat === 'AMRAP'
        const wodTotalRounds =
          (activeSec?.formatConfig?.totalRounds ??
            (currentExercise as WodAwareExercise | undefined)?.formatConfig
              ?.totalRounds ??
            0) || 0
        const amrapTimeCap =
          (activeSec?.formatConfig?.timeCapSeconds ??
            (currentExercise as WodAwareExercise | undefined)?.formatConfig
              ?.timeCapSeconds ??
            0) || 0

        return (
          <RoadmapPills
            exercises={sectionExercises}
            currentExerciseIdx={relativeCurrent}
            completedSets={completedSets}
            onGoToExercise={(relIdx) => handleGoToExercise(sectionStartIdx + relIdx)}
            wodMode={isEmomTabata && wodTotalRounds > 0}
            currentRound={currentWodRound}
            totalRounds={wodTotalRounds}
            amrapMode={isAmrap && amrapTimeCap > 0}
            amrapElapsedSeconds={amrapElapsed}
            amrapTimeCapSeconds={amrapTimeCap}
            forTimeMode={sectionFormat === 'ForTime' && forTimeProgress != null}
            forTimeActiveIdx={forTimeProgress?.activeIdx}
            forTimeTotalDuration={forTimeProgress?.totalDuration}
            forTimeElapsedSeconds={amrapElapsed}
          />
        )
      })()}
      {/* ScrollView hosts prestart / running / finished phases. The
          section-finished phase is rendered OUTSIDE the ScrollView (below)
          as a fixed, non-scrolling view — we omit the ScrollView entirely
          while that phase is active so it doesn't compete for the
          remaining flex:1 height. */}
      {(() => {
        // WOD workouts (EMOM / Tabata / AMRAP / ForTime) own their own
        // viewport — the timer hero is fixed-height and the rounds /
        // exercise list scrolls internally. Disable the outer scroller
        // so the whole page can't budge during a WOD run.
        const activeSecFormat =
          (currentExercise as WodAwareExercise | undefined)?.format ??
          sections[currentSectionIdx ?? 0]?.format ??
          null
        const isWodSectionActive =
          phase === 'running' && isWodFormat(activeSecFormat)
        return (
      <ScrollView
        style={[
          styles.scroll,
          (phase === 'sectionFinished' ||
            phase === 'prestart' ||
            phase === 'finished') && { display: 'none' },
        ]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isWodSectionActive}
      >

        {/* ── RUNNING ── */}
        {phase === 'running' && currentExercise && (
          <Animated.View key="running" entering={SlideInRight.duration(240)} exiting={SlideOutLeft.duration(180)}>
            {/* Branch on section format → per-exercise format override → movement type */}
            {(() => {
              const wodEx = currentExercise as unknown as WodAwareExercise
              const exFormat = wodEx.format
              const movementType = wodEx.movementType ?? 'Reps'
              const currentSet = currentExercise.sets?.[currentSetIdx]

              // Resolve effective WOD format: per-exercise override wins, otherwise
              // inherit from the section the current exercise belongs to. After the
              // sections refactor, the canonical format lives on the section — the
              // per-exercise field is only set when explicitly overridden.
              const currentSection = sections[currentSectionIdx ?? 0]
              const sectionFormat = currentSection?.format as typeof exFormat | undefined
              const sectionFormatConfig = currentSection?.formatConfig as typeof wodEx.formatConfig | undefined
              const effectiveFormat = exFormat ?? sectionFormat ?? null
              const effectiveFormatConfig = wodEx.formatConfig ?? sectionFormatConfig ?? null

              // WOD format → show WodTimerHero (uses the timer + round
              // prescription). ForTime sections may have no explicit config
              // (no time cap configured) — fall back to an empty config so
              // the timer still renders and applies its per-format defaults.
              const wodConfigForRender: WodConfig | null =
                effectiveFormatConfig ?? (effectiveFormat === 'ForTime' ? {} : null)
              if (isWodFormat(effectiveFormat) && wodConfigForRender) {
                // Section-level WOD = sectionFormat is set and the exercise
                // has no per-exercise override. In that case the WOD timer
                // encompasses the whole workout (all rounds across all
                // exercises in the section), so finishing it should land
                // on the section-finished summary instead of advancing one
                // exercise at a time. Per-exercise WOD overrides keep the
                // old advance-to-next-exercise behaviour.
                const isSectionLevelWod = exFormat == null && sectionFormat != null
                // EMOM / Tabata rotate through the section's exercises round
                // by round (round N → exercises[(N-1) % numExercises]). The
                // running parent's `currentExercise` is pinned to the
                // section's first exercise for the whole WOD, so we have to
                // derive the per-round label here instead of trusting
                // `currentExercise.exerciseName`. AMRAP/ForTime keep the
                // pinned label (their exercise list is shown elsewhere).
                const cycleByRound =
                  effectiveFormat === 'EMOM' || effectiveFormat === 'Tabata'
                const sectionExercisesForLabel = currentSection?.exercises ?? []
                const cycledExercise =
                  cycleByRound && sectionExercisesForLabel.length > 0
                    ? sectionExercisesForLabel[
                        (Math.max(1, currentWodRound) - 1) %
                          sectionExercisesForLabel.length
                      ]
                    : null
                const heroLabel =
                  cycledExercise?.exerciseName ??
                  currentExercise.exerciseName ??
                  ''
                return (
                  <WodTimerHero
                    label={heroLabel}
                    format={effectiveFormat}
                    config={wodConfigForRender}
                    onFinish={(result) => {
                      if (isSectionLevelWod) {
                        // Key the result by section id so the WorkoutLog
                        // serialises the WOD outcome at the section level.
                        const sectionId =
                          currentSection?.sectionId ??
                          `section-${currentSectionIdx ?? 0}`
                        storeFinalizeWod(sectionId, result)

                        const finishedIdx = currentSectionIdx ?? 0
                        const nextSectionIdx = finishedIdx + 1
                        // Surface the WOD's actual elapsed time on the
                        // summary hero. EMOM / AMRAP / Tabata / ForTime all
                        // now report `totalTimeSeconds` via WodResult, so
                        // the "Hotovo · X min" subtitle renders for every
                        // format (previously hard-coded null for WODs).
                        const wodDurationSeconds = result.totalTimeSeconds ?? null
                        // Always land on the section-finished interstitial
                        // (mirrors the exercise-free WOD branch). The pinned
                        // bottom CTA below adapts to either "next workout"
                        // (sibling exists) or "Continue → session summary"
                        // (last workout). Going directly to `'finished'`
                        // here previously left the user on a blank page
                        // for some sessions — funnelling everyone through
                        // the section summary first removes that hazard.
                        setFinishedSectionInfo({
                          sectionIdx: finishedIdx,
                          durationSeconds: wodDurationSeconds,
                        })
                        persistUpdate()
                        setPhase('sectionFinished')
                        return
                      }

                      // Per-exercise WOD override — finalise this exercise
                      // and advance to the next one (or end the session).
                      const exId =
                        currentExercise.exerciseExternalId ??
                        `ex-${currentExerciseIdx}`
                      storeFinalizeWod(exId, result)
                      const nextExIdx = currentExerciseIdx + 1
                      if (nextExIdx >= exercises.length) {
                        storeFinish()
                        setPhase('finished')
                        const logId = loadedLogId ?? activeLogId
                        if (logId) void finalizeWorkout(logId)
                      } else {
                        storeAdvance(nextExIdx, 0)
                        prefillForm(nextExIdx, 0, exercises)
                      }
                    }}
                    onCancel={handleWodCancel}
                    onRoundChange={setCurrentWodRound}
                    onElapsedChange={setAmrapElapsed}
                    onRoundsChange={setAmrapRounds}
                  />
                )
              }

              // Time or Distance movement type → show TimedExerciseFocus
              if (movementType === 'Time' || movementType === 'Distance') {
                return (
                  <TimedExerciseFocus
                    exerciseName={currentExercise.exerciseName ?? ''}
                    muscleColor={muscleColorFor(currentExercise)}
                    muscleLabel={currentExercise.exerciseName?.split(' ')[0] ?? ''}
                    exerciseIndex={currentExerciseIdx + 1}
                    exerciseTotal={exercises.length}
                    currentSet={currentSetIdx + 1}
                    totalSets={currentExercise.sets?.length ?? 0}
                    setStatuses={setStatuses}
                    movementType={movementType}
                    plannedDurationSeconds={currentSet?.durationSeconds ?? 60}
                    plannedDistanceMeters={
                      (currentSet as (typeof currentSet & { distanceMeters?: number }) | undefined)
                        ?.distanceMeters ?? 100
                    }
                    onSetDone={(durationSeconds, distanceMeters) => {
                      const exId = currentExercise.exerciseExternalId ?? `ex-${currentExerciseIdx}`
                      // Record actuals into their dedicated fields so buildRequest()
                      // can forward them to UpdateWorkoutWodRequest correctly.
                      storeMarkSetDone(exId, currentSetIdx, {
                        durationSeconds:
                          durationSeconds != null ? Math.round(durationSeconds) : undefined,
                        distanceMeters: distanceMeters != null ? distanceMeters : undefined,
                      })
                      const { nextExIdx, nextSetIdx, isLast } = computeNext(
                        currentExerciseIdx,
                        currentSetIdx,
                        exercises,
                      )
                      if (isLast) {
                        storeFinish()
                        setPhase('finished')
                        const logId = loadedLogId ?? activeLogId
                        if (logId) void finalizeWorkout(logId)
                      } else {
                        storeStartRest(currentExercise.restSeconds ?? currentSet?.restSeconds ?? 60)
                        persistUpdate()
                        pendingAdvanceRef.current = { ex: nextExIdx, set: nextSetIdx }
                      }
                    }}
                    onSkipSet={handleSkipSet}
                    onSkipExercise={handleSkipWorkout}
                    onGoToSet={handleGoToSet}
                  />
                )
              }

              // Default: reps × weight (Reps or RepsForTime)
              return (
                <LiveExerciseFocus
                  exerciseName={currentExercise.exerciseName ?? ''}
                  muscleColor={muscleColorFor(currentExercise)}
                  muscleLabel={currentExercise.exerciseName?.split(' ')[0] ?? ''}
                  exerciseIndex={currentExerciseIdx + 1}
                  exerciseTotal={exercises.length}
                  currentSet={currentSetIdx + 1}
                  totalSets={currentExercise.sets?.length ?? 0}
                  setStatuses={setStatuses}
                  reps={formReps}
                  plannedReps={currentExercise.sets?.[currentSetIdx]?.reps ?? 0}
                  weightKg={formWeight}
                  plannedWeightKg={currentExercise.sets?.[currentSetIdx]?.weightKg ?? 0}
                  onRepsChange={(delta) =>
                    setFormReps((prev) => Math.max(1, Math.round((prev + delta) * 10) / 10))
                  }
                  onWeightChange={(delta) =>
                    setFormWeight((prev) => Math.max(0, Math.round((prev + delta) * 10) / 10))
                  }
                  onSetDone={handleSetDone}
                  onSkipSet={handleSkipSet}
                  onSkipExercise={handleSkipWorkout}
                  onGoToSet={handleGoToSet}
                />
              )
            })()}

            {/* Sets / rounds list for current exercise — branched by format */}
            {(() => {
              // Resolve effective format for the active section.
              const activeSecForList = sections[currentSectionIdx ?? 0]
              const effectiveFormatForList =
                (currentExercise as WodAwareExercise).format ??
                activeSecForList?.format ??
                null
              const isWodForList = isWodFormat(effectiveFormatForList)
              const isEmomOrTabata =
                effectiveFormatForList === 'EMOM' || effectiveFormatForList === 'Tabata'

              // EMOM / Tabata: show RoundsList with round-based highlighting.
              if (isWodForList && isEmomOrTabata) {
                const sectionExercisesForList = activeSecForList?.exercises ?? []
                const totalRoundsForList =
                  (activeSecForList?.formatConfig?.totalRounds ??
                  (currentExercise as WodAwareExercise).formatConfig?.totalRounds ??
                  1)
                return (
                  <>
                    <View style={styles.sectionHdrWrap}>
                      <Text style={[styles.sectionHdr, { color: colors.label2 }]}>
                        {t('training.live.roundsSection')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.setsListCard,
                        { backgroundColor: colors.bg2, borderColor: colors.sep2 },
                      ]}
                    >
                      <RoundsList
                        sectionExercises={sectionExercisesForList}
                        totalRounds={totalRoundsForList}
                        currentRound={currentWodRound}
                      />
                    </View>
                  </>
                )
              }

              // AMRAP: show a list of the exercises that make up one round,
              // with their prescription on the right (matches the round
              // pills above but with more detail). Each row is a single
              // exercise — the user cycles through this list each round.
              if (isWodForList && effectiveFormatForList === 'AMRAP') {
                const amrapExercises = activeSecForList?.exercises ?? []
                return (
                  <>
                    <View style={styles.sectionHdrWrap}>
                      <Text style={[styles.sectionHdr, { color: colors.label2 }]}>
                        {t('training.live.roundsSection')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.setsListCard,
                        { backgroundColor: colors.bg2, borderColor: colors.sep2 },
                      ]}
                    >
                      {amrapExercises.map((ex, i) => {
                        const firstSet = ex.sets?.[0]
                        const reps = firstSet?.reps ?? 0
                        const weightKg = firstSet?.weightKg ?? 0
                        const isBodyweight = weightKg === 0
                        return (
                          <View
                            key={ex.exerciseExternalId ?? `ex-${i}`}
                            style={[
                              setsListStyles.row,
                              i < amrapExercises.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: colors.sep2,
                              },
                            ]}
                          >
                            <View
                              style={[
                                setsListStyles.badge,
                                { backgroundColor: colors.fill, borderColor: colors.sep },
                              ]}
                            >
                              <Text
                                style={[setsListStyles.badgeText, { color: colors.label2 }]}
                              >
                                {String(i + 1)}
                              </Text>
                            </View>
                            <View style={amrapListStyles.labelStack}>
                              <Text
                                style={[setsListStyles.setLabel, { color: colors.label }]}
                                numberOfLines={1}
                              >
                                {ex.exerciseName ?? `#${i + 1}`}
                              </Text>
                              {amrapRounds > 0 && reps > 0 && (
                                <Text
                                  style={[
                                    amrapListStyles.exerciseSummary,
                                    { color: colors.label3 },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {t('training.live.amrapExerciseDone', {
                                    rounds: amrapRounds,
                                    total: amrapRounds * reps,
                                  })}
                                </Text>
                              )}
                            </View>
                            <View style={setsListStyles.rightWrap}>
                              {firstSet != null ? (
                                <Text
                                  style={[setsListStyles.plannedText, { color: colors.label2 }]}
                                >
                                  {formatExerciseSummary(
                                    ex.sets ?? [],
                                    ex.movementType,
                                    true,
                                  )}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </>
                )
              }

              // ForTime: same exercise list as AMRAP — each row shows one
              // exercise with its prescription (reps × weight). No round
              // multipliers since ForTime is "do it once, fast as possible".
              if (isWodForList && effectiveFormatForList === 'ForTime') {
                const forTimeExercises = activeSecForList?.exercises ?? []
                return (
                  <>
                    <View style={styles.sectionHdrWrap}>
                      <Text style={[styles.sectionHdr, { color: colors.label2 }]}>
                        {t('training.live.workoutPlanSection')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.setsListCard,
                        { backgroundColor: colors.bg2, borderColor: colors.sep2 },
                      ]}
                    >
                      {forTimeExercises.map((ex, i) => {
                        const firstSet = ex.sets?.[0]
                        // Auto-progression based on cumulative elapsed
                        // time when every exercise carries a
                        // `durationSeconds` (computed at component
                        // level into `forTimeProgress`). Rows before
                        // the active idx are marked done (green badge
                        // + ✓), the active row gets the gold accent,
                        // pending rows stay neutral.
                        const ftActiveIdx = forTimeProgress?.activeIdx ?? -1
                        const isFtDone = ftActiveIdx > i
                        const isFtActive = ftActiveIdx === i
                        return (
                          <View
                            key={ex.exerciseExternalId ?? `ex-${i}`}
                            style={[
                              setsListStyles.row,
                              i < forTimeExercises.length - 1 && {
                                borderBottomWidth: StyleSheet.hairlineWidth,
                                borderBottomColor: colors.sep2,
                              },
                              { opacity: isFtDone || isFtActive ? 1 : 0.72 },
                            ]}
                          >
                            <View
                              style={[
                                setsListStyles.badge,
                                isFtDone
                                  ? { backgroundColor: colors.green + '14', borderColor: colors.green }
                                  : isFtActive
                                    ? { backgroundColor: colors.fill, borderColor: colors.gold }
                                    : { backgroundColor: colors.fill, borderColor: colors.sep },
                              ]}
                            >
                              <Text
                                style={[
                                  setsListStyles.badgeText,
                                  {
                                    color: isFtDone
                                      ? colors.green
                                      : isFtActive
                                        ? colors.gold
                                        : colors.label2,
                                  },
                                ]}
                              >
                                {isFtDone ? '✓' : String(i + 1)}
                              </Text>
                            </View>
                            <View style={setsListStyles.labelWrap}>
                              <Text
                                style={[
                                  setsListStyles.setLabel,
                                  {
                                    color: colors.label,
                                    fontWeight: isFtActive ? '600' : '400',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {ex.exerciseName ?? `#${i + 1}`}
                              </Text>
                            </View>
                            <View style={setsListStyles.rightWrap}>
                              {firstSet != null ? (
                                <Text
                                  style={[setsListStyles.plannedText, { color: colors.label2 }]}
                                >
                                  {formatExerciseSummary(
                                    ex.sets ?? [],
                                    ex.movementType,
                                    true,
                                  )}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  </>
                )
              }

              // Other WOD (none currently): no list — the WodTimerHero is
              // the only affordance.
              if (isWodForList) {
                return null
              }

              // Standard / reps-based: show the exercise queue ("PLÁN
              // WORKOUTU") instead of the per-exercise SetsList. The form
              // card above already tracks the current set; the queue keeps
              // the user oriented within the whole workout.
              //
              // currentExerciseIdx is always section-relative: storeAdvance(0,0)
              // resets it when a new section starts and setExercises() updates
              // the local exercises to the current section. No subtraction is
              // needed — using it directly as the relative index is correct.
              const queueExercises = activeSecForList?.exercises ?? []
              return (
                <>
                  <View style={styles.sectionHdrWrap}>
                    <Text style={[styles.sectionHdr, { color: colors.label2 }]}>
                      {t('training.live.workoutPlanSection')}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.setsListCard,
                      { backgroundColor: colors.bg2, borderColor: colors.sep2 },
                    ]}
                  >
                    <ExerciseQueue
                      exercises={queueExercises}
                      currentRelativeIdx={currentExerciseIdx}
                      currentSetIdx={currentSetIdx}
                      formOverrides={formOverrides}
                      onGoToSet={(relIdx, setIdx) => {
                        // Cross-exercise jump (different relative index) or
                        // same-exercise set jump — handle both via the same
                        // storeAdvance + prefillForm pair, so the form card
                        // re-populates with this set's planned prescription.
                        // relIdx is already section-relative and matches
                        // currentExerciseIdx's coordinate space (both are
                        // relative to the current section's exercises array).
                        storeSkipRest()
                        pendingAdvanceRef.current = null
                        storeAdvance(relIdx, setIdx)
                        prefillForm(relIdx, setIdx, exercises)
                      }}
                    />
                  </View>
                </>
              )
            })()}

            {/* DALŠÍ next-preview removed — the freed vertical space is given
                back to the sets/rounds list above (see RoundsList maxHeight
                bump). The roadmap pills + section-finished interstitial
                already communicate "what's next" without an inline preview. */}
          </Animated.View>
        )}

        {/* ── RUNNING — exercise-free WOD section (e.g. ForTime "Beh") ──
            When a section carries a WOD format but no exercises, the
            block above can't render because it gates on currentExercise.
            Mount the WodTimerHero directly off the section's own
            format/config so the user still sees the timer + controls. */}
        {phase === 'running' && !currentExercise && (() => {
          const sec = sections[currentSectionIdx ?? 0]
          const secFormat = sec?.format ?? null
          if (!sec || !isWodFormat(secFormat)) return null
          // ForTime sections may have no explicit config — fall back to {}
          // so the timer applies its per-format defaults.
          const cfg: WodConfig | null =
            (sec.formatConfig as WodConfig | null) ??
            (secFormat === 'ForTime' ? {} : null)
          if (!cfg) return null
          return (
            <Animated.View
              key="running-section-wod"
              entering={SlideInRight.duration(240)}
              exiting={SlideOutLeft.duration(180)}
            >
              <WodTimerHero
                label={sec.name ?? ''}
                format={secFormat}
                config={cfg}
                onFinish={(result) => {
                  const sectionId =
                    sec.sectionId ?? `section-${currentSectionIdx ?? 0}`
                  storeFinalizeWod(sectionId, result)
                  const finishedIdx = currentSectionIdx ?? 0
                  const nextSectionIdx = finishedIdx + 1
                  const wodDurationSeconds = result.totalTimeSeconds ?? null
                  // Always land on the section-finished interstitial — the
                  // pinned bottom CTA below adapts to either "next workout"
                  // (sibling exists) or "back to today" (last workout).
                  // Falling through to the `'finished'` phase here used to
                  // produce a blank page for exercise-free WOD sections
                  // because LiveFinishedSummary requires a populated
                  // `finishedSummary` memo that can be null for empty
                  // exercise lists.
                  setFinishedSectionInfo({
                    sectionIdx: finishedIdx,
                    durationSeconds: wodDurationSeconds,
                  })
                  persistUpdate()
                  setPhase('sectionFinished')
                }}
                onCancel={handleWodCancel}
                onRoundChange={setCurrentWodRound}
                onElapsedChange={setAmrapElapsed}
                onRoundsChange={setAmrapRounds}
              />
            </Animated.View>
          )
        })()}

        {/* Section-finished and finished views are rendered OUTSIDE the
            ScrollView (below) so they aren't scrollable — the summary
            cards + next-workout / back-to-today CTA are pinned to the
            screen edges. */}

        {/* Bottom spacer — skipped when the section-finished / finished
            CTA is pinned below the ScrollView (its own padding takes
            over). */}
        {!(
          (phase === 'sectionFinished' && finishedSectionInfo) ||
          phase === 'finished'
        ) && <View style={{ height: 24 }} />}
      </ScrollView>
        )
      })()}

      {/* ── PRE-START ── (rendered OUTSIDE the ScrollView so the hero +
          summary stay anchored; only the workouts list inside PreStart
          scrolls internally. flex:1 fills the remaining viewport between
          the header and the pinned Start button below.) */}
      {phase === 'prestart' && (
        <View style={sectionFinishedStyles.fixedWrap}>
          <Animated.View
            key="prestart"
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(160)}
            style={sectionFinishedStyles.fixedAnimated}
          >
            <PreStart
              sessionName={sessionDisplayName}
              sections={sections}
              exerciseMuscleGroups={exerciseMuscleGroups}
              onStart={handleStart}
            />
          </Animated.View>
        </View>
      )}

      {/* ── FINISHED (session summary) ── (rendered OUTSIDE the ScrollView
          so the hero stays anchored; only the inner workouts list scrolls.
          flex:1 fills the viewport between the header and the pinned
          "Zpět na dnešek" CTA below.) */}
      {phase === 'finished' && finishedSummary && (
        <View style={sectionFinishedStyles.fixedWrap}>
          <Animated.View
            key="finished"
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(180)}
            style={sectionFinishedStyles.fixedAnimated}
          >
            <LiveFinishedSummary
              sessionName={sessionDisplayName}
              durationFormatted={finishedSummary.durationFormatted}
              workouts={finishedWorkoutCards}
              prCount={finishedSummary.prCount}
            />
          </Animated.View>
        </View>
      )}

      {/* ── SECTION FINISHED INTERSTITIAL ── (rendered OUTSIDE the ScrollView
          so the summary view is fixed — no scrolling. The flex:1 wrapper
          fills the remaining viewport between the header / roadmap pills
          and the pinned CTA below.) */}
      {phase === 'sectionFinished' && finishedSectionInfo && (
        <View style={sectionFinishedStyles.fixedWrap}>
          <Animated.View
            key="section-finished"
            entering={FadeIn.duration(220)}
            exiting={FadeOut.duration(160)}
            style={sectionFinishedStyles.fixedAnimated}
          >
            {(() => {
              // Resolve the finished section's WOD context (if any), so the
              // summary stats card can render format-specific cells (rounds,
              // failed rounds, extra reps) instead of the set-based defaults.
              const finishedSec = sections[finishedSectionInfo.sectionIdx]
              const resolvedFinished = finishedSec
                ? resolveSection(finishedSec, sessionFormat, sessionFormatConfig)
                : null
              const finishedFormat = resolvedFinished?.format ?? null
              const finishedTotalRounds =
                resolvedFinished?.formatConfig?.totalRounds ?? null
              // Section-level WOD result is keyed by sectionId; per-exercise
              // overrides aren't covered here (the per-exercise WOD case
              // exits via a different `onFinish` path that doesn't reach
              // sectionFinished).
              const finishedSectionId = finishedSec?.sectionId ?? null
              const finishedWodResult: WodResult | null =
                finishedSectionId && wodResults[finishedSectionId]
                  ? wodResults[finishedSectionId]
                  : null

              return (
                <SectionFinishedScreen
                  durationSeconds={finishedSectionInfo.durationSeconds}
                  exerciseSummaries={(() => {
                    const finishedExercises = finishedSec?.exercises ?? []
                    return finishedExercises.map((ex) => {
                      const exId = ex.exerciseExternalId ?? ''
                      const overrides = formOverrides[exId] ?? {}
                      const doneSetIdxs = new Set(completedSets[exId] ?? [])
                      const plannedSets = ex.sets ?? []
                      const sets = plannedSets.map((planned, sIdx) => {
                        const ovr = overrides[sIdx]
                        return {
                          setNumber: planned.setNumber ?? sIdx + 1,
                          reps: ovr?.reps ?? planned.reps ?? null,
                          weightKg: ovr?.weightKg ?? planned.weightKg ?? null,
                          // Only sets actually marked done contribute to the
                          // stats card / per-exercise meta — pressing
                          // "Skip workout" before completing anything used
                          // to inflate totals with planned values.
                          done: doneSetIdxs.has(sIdx),
                        }
                      })
                      // Build treatment-B fields: actual headline + "plán X"
                      // caption + gold change-dot when the user edited a value.
                      // Mirrors the finishedWorkoutCards memo used by
                      // LiveFinishedSummary (#468).
                      const doneIndices = completedSets[exId] ?? []
                      const isExSkipped = skippedExercises.includes(exId)
                      const skippedIndices = isExSkipped
                        ? plannedSets.map((_, si) => si)
                        : (skippedSets[exId] ?? [])
                      const completedSetNumbers = doneIndices.map(
                        (si) => plannedSets[si]?.setNumber ?? si + 1,
                      )
                      const skippedSetNumbers = skippedIndices.map(
                        (si) => plannedSets[si]?.setNumber ?? si + 1,
                      )
                      const loggedSets: LoggedSetDto[] = plannedSets.map(
                        (planned, si) => {
                          const ovr = overrides[si]
                          const isDone = doneIndices.includes(si)
                          const actualReps = isDone
                            ? (ovr?.reps ?? planned.reps ?? null)
                            : null
                          const actualWeightKg = isDone
                            ? (ovr?.weightKg ?? planned.weightKg ?? null)
                            : null
                          const actualDurationSeconds = isDone
                            ? (ovr?.durationSeconds ?? null)
                            : null
                          const actualDistanceMeters = isDone
                            ? (ovr?.distanceMeters ?? null)
                            : null
                          const repsModified =
                            isDone &&
                            actualReps != null &&
                            planned.reps != null &&
                            actualReps !== planned.reps
                          const weightModified =
                            isDone &&
                            actualWeightKg != null &&
                            planned.weightKg != null &&
                            actualWeightKg !== planned.weightKg
                          const durationModified =
                            isDone &&
                            actualDurationSeconds != null &&
                            planned.durationSeconds != null &&
                            actualDurationSeconds !== planned.durationSeconds
                          return {
                            setNumber: planned.setNumber ?? si + 1,
                            actualReps: actualReps ?? undefined,
                            actualWeightKg: actualWeightKg ?? undefined,
                            actualDurationSeconds:
                              actualDurationSeconds ?? undefined,
                            actualDistanceMeters:
                              actualDistanceMeters ?? undefined,
                            plannedReps: planned.reps ?? undefined,
                            plannedWeightKg: planned.weightKg ?? undefined,
                            plannedDurationSeconds:
                              planned.durationSeconds ?? undefined,
                            plannedDistanceMeters:
                              planned.distanceMeters ?? undefined,
                            isModified:
                              repsModified || weightModified || durationModified,
                          }
                        },
                      )
                      return {
                        name: ex.exerciseName ?? '',
                        sets,
                        plannedSets,
                        completedSetNumbers,
                        skippedSetNumbers,
                        loggedSets,
                      }
                    })
                  })()}
                  sectionFormat={finishedFormat}
                  totalRounds={finishedTotalRounds}
                  wodResult={finishedWodResult}
                />
              )
            })()}
          </Animated.View>
        </View>
      )}

      {/* Pinned bottom CTA for the pre-start screen — gold "Start trénink"
          button glued to the bottom of the screen (above safe-area inset)
          so the start CTA is always reachable regardless of how tall the
          workouts list above it is. Mirrors the section-finished pinned
          CTA pattern. */}
      {phase === 'prestart' && (
        <View
          style={[
            styles.pinnedCtaWrap,
            { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
          ]}
        >
          <Pressable
            style={[styles.pinnedCtaBtn, { backgroundColor: colors.gold }]}
            onPress={handleStart}
          >
            <Text style={[styles.pinnedCtaBtnText, { color: colors.onAccent }]}>
              {t('training.live.startButton')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Pinned bottom slot for the section-finished interstitial — the
          next-workout preview card sits directly above the gold "Pokračovat
          na další workout" CTA so the user can see what they're about to
          start while their thumb hovers over the button. */}
      {phase === 'sectionFinished' && finishedSectionInfo && (() => {
        const nextIdx = finishedSectionInfo.sectionIdx + 1
        const nextSec = sections[nextIdx]
        const nextWorkout: SectionFinishedNextWorkout | null = (() => {
          if (!nextSec) return null
          const resolved = resolveSection(
            nextSec,
            sessionFormat,
            sessionFormatConfig,
          )
          const effFormat = resolved.format ?? null
          const effCfg = resolved.formatConfig ?? null
          // AMRAP doesn't have a meaningful "rounds" count up front — the
          // user maxes out rounds within the time cap. Suppress the
          // "0 kol" line on the next-workout preview for this format.
          const previewTotalRounds =
            effFormat === 'AMRAP' ? null : effCfg?.totalRounds ?? null
          return {
            name: nextSec.name ?? '',
            format: effFormat,
            exerciseCount: resolved.exercises.length,
            estimatedDurationSeconds: estimatedSectionDurationSeconds(
              effFormat,
              effCfg,
            ),
            totalRounds: previewTotalRounds,
          }
        })()
        return (
          <View
            style={[
              styles.pinnedCtaWrap,
              { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
            ]}
          >
            {nextWorkout && (
              <View style={styles.pinnedNextCardWrap}>
                <NextWorkoutPreviewCard nextWorkout={nextWorkout} />
              </View>
            )}
            <Pressable
              style={[styles.pinnedCtaBtn, { backgroundColor: colors.gold }]}
              onPress={() => {
                // No next workout — this was the last section. Mark the
                // session finished here (not in onFinish) so that the
                // backend only receives the complete signal once the client
                // explicitly taps through to the session-summary screen.
                // This prevents the web portal from flipping state while
                // the client is still on the last-section interstitial.
                if (!nextSec) {
                  storeFinish()
                  const logId = loadedLogId ?? activeLogId
                  if (logId) void finalizeWorkout(logId)
                  setFinishedSectionInfo(null)
                  setPhase('finished')
                  return
                }
                sectionStartTimestampsRef.current.set(nextIdx, Date.now())
                storeAdvanceSection(nextIdx)
                const resolved = resolveSection(
                  nextSec,
                  sessionFormat,
                  sessionFormatConfig,
                )
                setExercises(resolved.exercises)
                storeAdvance(0, 0)
                prefillForm(0, 0, resolved.exercises)
                // showWodHero removed (#338) — inline Sites #1 and #2
                // render WodTimerHero based on phase + section format directly.
                setFinishedSectionInfo(null)
                setPhase('running')
              }}
            >
              <Text style={[styles.pinnedCtaBtnText, { color: colors.onAccent }]}>
                {nextSec
                  ? t('training.live.startNextWorkout')
                  : t('common.continue')}
              </Text>
            </Pressable>
          </View>
        )
      })()}

      {/* Pinned bottom CTA for the finished (session summary) screen —
          gold "Zpět na dnešek" button glued to the bottom of the screen,
          mirroring the prestart / section-finished pinned-CTA pattern. */}
      {phase === 'finished' && finishedSummary && (
        <View
          style={[
            styles.pinnedCtaWrap,
            { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
          ]}
        >
          <Pressable
            style={[styles.pinnedCtaBtn, { backgroundColor: colors.gold }]}
            onPress={handleBackToToday}
          >
            <Text style={[styles.pinnedCtaBtnText, { color: colors.onAccent }]}>
              {t('training.live.backToToday')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── OVERLAYS ── */}

      {/* Rest timer overlay */}
      {restActive && restStartedAt && restSeconds && (
        <Animated.View
          key="rest-overlay"
          entering={SlideInDown.duration(260)}
          exiting={SlideOutDown.duration(220)}
          style={StyleSheet.absoluteFill}
        >
          <RestTimerHero
            restSeconds={restSeconds}
            restStartedAt={restStartedAt}
            nextExerciseName={nextExerciseForRest?.exerciseName ?? ''}
            nextSetMeta={nextSetMeta}
            onSkipRest={handleSkipRest}
          />
        </Animated.View>
      )}

      {/* Section runner overlay — removed; inter-section state now uses phase === 'sectionFinished' */}

      {/* PR flash overlay */}
      <PrFlash
        visible={prVisible}
        onDismiss={() => setPrVisible(false)}
      />

      {/* SkipConfirmSheet removed — the "Skip workout" affordance now goes
          straight to the section-finished interstitial without confirmation,
          since that screen itself is reviewable and reversible (the user can
          back out before tapping "Start next workout"). */}

      {/* Site #3 (overlay, fix/#338) removed — duplicate of the inline render sites.
          Sites #1 (with-exercise, ~line 3060) and #2 (exercise-free, ~line 3522) each
          carry their own Animated.View SlideInRight wrapper and thread all three
          callbacks (onElapsedChange, onRoundsChange, onRoundChange). The overlay
          was the incomplete duplicate: it omitted onElapsedChange + onRoundsChange,
          breaking RoadmapPills time-fill and the AMRAP rounds counter. */}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  // Pinned-bottom CTA used by the section-finished interstitial — sits at the
  // bottom of the screen, above the safe-area inset.
  pinnedCtaWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Spacing between the pinned next-workout card and the gold CTA below it.
  pinnedNextCardWrap: {
    marginBottom: 12,
  },
  pinnedCtaBtn: {
    borderRadius: Radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pinnedCtaBtnText: {
    ...Type.callout,
    fontWeight: '600',
  },
  // Pinned-bottom NEXT preview wrapper — used in the running phase to keep the
  // bordered next-exercise/section card glued to the bottom of the screen so
  // it never scrolls out of view as the rounds/sets list above it grows. No
  // top border — the DALŠÍ eyebrow above the card provides the visual break.
  sectionHdrWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionHdr: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 13,
  },
  setsListCard: {
    marginHorizontal: 16,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
})
