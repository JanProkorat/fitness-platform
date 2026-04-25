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

import { startWorkout, updateWorkout, completeWorkout } from '@/api/workouts'
import type { UpdateWorkoutRequest } from '@/api/workouts'
import type { SessionExercise, ExerciseSet, MuscleGroup } from '@/api/training'
import { getTodaySession } from '@/api/training'
import { getMuscleGroupColor } from '@/constants/muscleGroups'

import { useLiveSessionStore } from '@/stores/liveSessionStore'
import { addPendingMutation } from '@/stores/offline'

import { LiveSessionHeader } from '@/components/training/LiveSessionHeader'
import { LiveExerciseFocus } from '@/components/training/LiveExerciseFocus'
import { RestTimerHero } from '@/components/training/RestTimerHero'
import { PrFlash } from '@/components/training/PrFlash'
import { LiveFinishedSummary } from '@/components/training/LiveFinishedSummary'
import { ExpandableExerciseCard } from '@/components/training/ExpandableExerciseCard'

import {
  isPR,
  computeLiveSummary,
  formatSeconds,
} from '@/components/training/liveTrainingHelpers'
import type { ExerciseSummaryInput } from '@/components/training/liveTrainingHelpers'

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

  return (
    <>
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
    </>
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

// ─── Exercise roadmap pills ───────────────────────────────────────────────────

interface RoadmapPillsProps {
  exercises: SessionExercise[]
  currentExerciseIdx: number
  completedSets: Record<string, number[]>
  onGoToExercise: (idx: number) => void
}

function RoadmapPills({
  exercises,
  currentExerciseIdx,
  completedSets,
  onGoToExercise,
}: RoadmapPillsProps) {
  const colors = useTheme()

  // Total done across all exercises
  const totalDone = useMemo(() => {
    let n = 0
    for (const sets of Object.values(completedSets)) n += sets.length
    return n
  }, [completedSets])

  const totalSets = useMemo(
    () => exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0),
    [exercises],
  )

  const pct = totalSets > 0 ? totalDone / totalSets : 0

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
          const done = completedSets[exId]?.length ?? 0
          const total = ex.sets?.length ?? 0
          const isActive = i === currentExerciseIdx
          const isFull = done === total && total > 0

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
                {done}/{total}
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
  exercises: SessionExercise[]
  exerciseMuscleGroups: Record<string, MuscleGroup[]>
  onStart: () => void
}

function PreStart({ sessionName, exercises, exerciseMuscleGroups, onStart }: PreStartProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const totalSets = exercises.reduce((n, ex) => n + (ex.sets?.length ?? 0), 0)
  // Rough estimate: ~2 min per set + rest overhead
  const estimatedMin = Math.round(totalSets * 2.5)

  return (
    <View>
      {/* Hero card */}
      <View style={[preStyles.heroCard, { backgroundColor: colors.heroBg }]}>
        <View style={preStyles.heroBody}>
          <Text style={preStyles.heroEyebrow}>{t('training.live.preStartReady')}</Text>
          <Text style={preStyles.heroName}>
            {sessionName.split('·').slice(-1)[0].trim()}
          </Text>
          <Text style={[preStyles.heroMeta, { color: 'rgba(255,255,255,0.7)' }]}>
            {t('training.live.preStartMeta', {
              exercises: exercises.length,
              sets: totalSets,
              minutes: estimatedMin,
            })}
          </Text>
        </View>
        <Pressable
          style={[preStyles.startBtn, { backgroundColor: colors.gold }]}
          onPress={onStart}
        >
          <Text style={[preStyles.startBtnText, { color: colors.onAccent }]}>
            {t('training.live.startButton')}
          </Text>
        </Pressable>
      </View>

      {/* Exercise list */}
      <View style={preStyles.listHeader}>
        <Text style={[preStyles.listHeaderText, { color: colors.label2 }]}>
          {t('training.live.todayExercises')}
        </Text>
      </View>
      <View style={[preStyles.listCard, { backgroundColor: colors.bg2 }]}>
        {exercises.map((ex, i) => {
          const sets = ex.sets ?? []
          const firstSet = sets[0]
          const isBodyweight = (firstSet?.weightKg ?? 0) === 0
          const summaryText = sets.length > 0
            ? `${sets.length} × ${firstSet?.reps ?? 0} ${t('training.reps')} · ${
                isBodyweight ? t('training.live.bw') : `${firstSet?.weightKg ?? 0} kg`
              }`
            : ''
          const mgs = ex.exerciseExternalId
            ? (exerciseMuscleGroups[ex.exerciseExternalId] ?? [])
            : []
          const bodyParts = mgs.map((mg) => ({
            label: t(`muscleGroup.${mg}`),
            color: getMuscleGroupColor(mg, colors),
          }))

          return (
            <ExpandableExerciseCard
              key={i}
              name={ex.exerciseName ?? `Exercise ${i + 1}`}
              summaryText={summaryText}
              bodyParts={bodyParts.length > 0 ? bodyParts : undefined}
              isCompleted={false}
              defaultExpanded={false}
              hideCompletionIndicator
            >
              <View>
                {sets.map((s, si) => {
                  const bw = (s.weightKg ?? 0) === 0
                  return (
                    <View
                      key={si}
                      style={[
                        preStyles.setRow,
                        si < sets.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.sep2,
                        },
                      ]}
                    >
                      <Text style={[preStyles.setRowNum, { color: colors.label3 }]}>
                        {si + 1}
                      </Text>
                      <Text style={[preStyles.setRowText, { color: colors.label2 }]}>
                        {s.reps} ×{' '}
                        {bw ? t('training.live.bw') : `${s.weightKg ?? 0} kg`}
                      </Text>
                      {(s.restSeconds ?? 0) > 0 && (
                        <Text style={[preStyles.setRowRest, { color: colors.label3 }]}>
                          {s.restSeconds} s
                        </Text>
                      )}
                    </View>
                  )
                })}
              </View>
            </ExpandableExerciseCard>
          )
        })}
      </View>
    </View>
  )
}

const preStyles = StyleSheet.create({
  heroCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  heroBody: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    letterSpacing: 0.08 * 11,
    marginBottom: 8,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  heroMeta: {
    fontSize: 13,
    marginTop: 4,
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  setRowNum: {
    width: 16,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  setRowText: {
    flex: 1,
    fontSize: 13,
  },
  setRowRest: {
    fontSize: 12,
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
    completedSets,
    skippedSets,
    skippedExercises,
    restStartedAt,
    restSeconds,
    startedAt,
    finishedAt,
    formOverrides,
    start: storeStart,
    markSetDone: storeMarkSetDone,
    skipSet: storeSkipSet,
    skipExercise: storeSkipExercise,
    startRest: storeStartRest,
    skipRest: storeSkipRest,
    advance: storeAdvance,
    close: storeClose,
    finish: storeFinish,
    discard: storeDiscard,
  } = store

  // ── Phase: prestart | running | finished ──
  const [phase, setPhase] = useState<'prestart' | 'running' | 'finished'>(() => {
    // Restore phase from store on mount
    if (activeLogId !== null && finishedAt !== null) return 'finished'
    if (activeLogId !== null && finishedAt === null) return 'running'
    return 'prestart'
  })

  // ── Session exercises (from API) ──
  const [exercises, setExercises] = useState<SessionExercise[]>([])
  const [exerciseMuscleGroups, setExerciseMuscleGroups] = useState<
    Record<string, MuscleGroup[]>
  >({})
  const [sessionDisplayName, setSessionDisplayName] = useState('')
  const [loadedLogId, setLoadedLogId] = useState<string | null>(
    id !== 'new' && id ? id : (activeLogId ?? null),
  )

  // ── Local form state (reps / weight steppers) ──
  const [formReps, setFormReps] = useState(0)
  const [formWeight, setFormWeight] = useState(0)

  // ── PR flash ──
  const [prVisible, setPrVisible] = useState(false)
  const prCountRef = useRef(0)

  // ── Confirm sheet ──
  const [showSkipExerciseConfirm, setShowSkipExerciseConfirm] = useState(false)

  // ── Elapsed timer (local interval, drives display only) ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Mutations ──
  const updateMutation = useMutation({
    mutationFn: ({ logId, req }: { logId: string; req: UpdateWorkoutRequest }) =>
      updateWorkout(logId, req),
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
        const sessions = resp.sessions ?? []
        const session =
          (sessionId && sessions.find((s) => s.sessionId === sessionId)) ||
          sessions[0]
        if (!session) return
        setSessionDisplayName(session.name ?? '')
        setExercises(session.exercises ?? [])
        setExerciseMuscleGroups(resp.exerciseMuscleGroups ?? {})
      } catch {
        // Non-fatal — screen still works with empty exercises in pre-start
      }
    }
    void load()
  }, [sessionId])

  // ── Start fresh workout (id === "new") ──
  useEffect(() => {
    if (id !== 'new') return
    async function startNew() {
      try {
        const resp = await startWorkout({
          planId: planId ?? undefined,
          sessionId: sessionId ?? undefined,
        })
        const newLogId = resp.logId ?? null
        if (newLogId) setLoadedLogId(newLogId)
      } catch {
        Alert.alert(t('common.error'), t('training.startError'))
      }
    }
    void startNew()
  }, [id, planId, sessionId, t])

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
    if (phase === 'running' && startedAt) {
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
  const buildRequest = useCallback((): UpdateWorkoutRequest => {
    const state = useLiveSessionStore.getState()
    return {
      exercises: exercises.map((ex) => {
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
            completedAt:
              isDone || isSkipped ? new Date().toISOString() : undefined,
          }
        })
        return {
          exerciseExternalId: exId,
          exerciseName: ex.exerciseName ?? '',
          sets,
        }
      }),
    }
  }, [exercises])

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
    // TODO: handle case where logId is not yet available when resuming an existing log
    if (!sessionId) {
      console.warn('[handleStart] sessionId is empty — route param may be malformed')
    }
    storeStart({ sessionId: sessionId ?? '' }, logId ?? '', planId ?? '')
    setPhase('running')
    prefillForm(0, 0, exercises)
  }, [storeStart, loadedLogId, activeLogId, exercises, sessionId, planId, prefillForm])

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
      // Last set of last exercise — finish
      storeFinish()
      setPhase('finished')
      const logId = loadedLogId ?? activeLogId
      if (logId) void finalizeWorkout(logId)
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
      storeFinish()
      setPhase('finished')
      const logId = loadedLogId ?? activeLogId
      if (logId) void finalizeWorkout(logId)
      return
    }
    storeAdvance(nextExIdx, nextSetIdx)
    prefillForm(nextExIdx, nextSetIdx, exercises)
    persistUpdate()
  }, [
    exercises,
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

  const handleSkipExercise = useCallback(() => {
    setShowSkipExerciseConfirm(false)
    const ex = exercises[currentExerciseIdx]
    if (!ex) return
    const exId = ex.exerciseExternalId ?? `ex-${currentExerciseIdx}`
    storeSkipExercise(exId)

    const nextExIdx = currentExerciseIdx + 1
    if (nextExIdx >= exercises.length) {
      storeFinish()
      setPhase('finished')
      const logId = loadedLogId ?? activeLogId
      if (logId) void finalizeWorkout(logId)
      return
    }
    storeAdvance(nextExIdx, 0)
    prefillForm(nextExIdx, 0, exercises)
    persistUpdate()
  }, [
    exercises,
    currentExerciseIdx,
    storeSkipExercise,
    storeFinish,
    storeAdvance,
    prefillForm,
    loadedLogId,
    activeLogId,
    finalizeWorkout,
    persistUpdate,
  ])

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

  // ── Derived: total sets done (for header) ──
  const totalSetsDone = useMemo(() => {
    let n = 0
    for (const sets of Object.values(completedSets)) n += sets.length
    return n
  }, [completedSets])

  const totalSetsAll = useMemo(
    () => exercises.reduce((n, ex) => n + (ex.sets?.length ?? 0), 0),
    [exercises],
  )

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

  // ── Next exercise preview ──
  const nextExercise = exercises[currentExerciseIdx + 1]
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
      {/* Header — always visible; on prestart the timer reads 00:00 and 0/N sets. */}
      <LiveSessionHeader
        sessionName={sessionDisplayName}
        elapsedSeconds={elapsedSeconds}
        setsDone={totalSetsDone}
        setsTotal={totalSetsAll}
        onClose={handleClose}
        closePending={updateMutation.isPending}
      />

      {/* Roadmap — visible only while running */}
      {phase === 'running' && (
        <RoadmapPills
          exercises={exercises}
          currentExerciseIdx={currentExerciseIdx}
          completedSets={completedSets}
          onGoToExercise={handleGoToExercise}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── PRE-START ── */}
        {phase === 'prestart' && (
          <Animated.View key="prestart" entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)}>
            <PreStart
              sessionName={sessionDisplayName}
              exercises={exercises}
              exerciseMuscleGroups={exerciseMuscleGroups}
              onStart={handleStart}
            />
          </Animated.View>
        )}

        {/* ── RUNNING ── */}
        {phase === 'running' && currentExercise && (
          <Animated.View key="running" entering={SlideInRight.duration(240)} exiting={SlideOutLeft.duration(180)}>
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
              onSkipExercise={() => setShowSkipExerciseConfirm(true)}
              onGoToSet={handleGoToSet}
            />

            {/* Sets list for current exercise */}
            <View style={styles.sectionHdrWrap}>
              <Text style={[styles.sectionHdr, { color: colors.label2 }]}>
                {t('training.live.setsSection')}
              </Text>
            </View>
            <View
              style={[
                styles.setsListCard,
                { backgroundColor: colors.bg2, borderColor: colors.sep2 },
              ]}
            >
              <SetsList
                exercise={currentExercise}
                completedSets={completedSets[currentExId] ?? []}
                skippedSets={skippedSets[currentExId] ?? []}
                currentSetIdx={currentSetIdx}
                formOverrides={formOverrides[currentExId] ?? {}}
                onGoToSet={handleGoToSet}
              />
            </View>

            {/* Next exercise preview */}
            {nextExercise && (
              <View
                style={[
                  styles.nextExerciseCard,
                  { backgroundColor: colors.bg2, borderColor: colors.sep2 },
                ]}
              >
                <Text style={[styles.nextExerciseLabel, { color: colors.label3 }]}>
                  {t('training.live.nextLabel')}
                </Text>
                <View style={styles.nextExerciseInfo}>
                  <View style={styles.nextExerciseText}>
                    <Text style={[styles.nextExerciseName, { color: colors.label }]}>
                      {nextExercise.exerciseName}
                    </Text>
                    <Text style={[styles.nextExerciseMeta, { color: colors.label3 }]}>
                      {nextExercise.sets?.length ?? 0} {t('training.sets')} ·{' '}
                      {nextExercise.exerciseName?.split(' ')[0]}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.nextExerciseDot,
                      { backgroundColor: muscleColorFor(nextExercise) },
                    ]}
                  />
                </View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── FINISHED ── */}
        {phase === 'finished' && finishedSummary && (
          <Animated.View key="finished" entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)}>
            <LiveFinishedSummary
              sessionName={sessionDisplayName}
              summary={finishedSummary}
              onBackToToday={handleBackToToday}
            />
          </Animated.View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

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

      {/* PR flash overlay */}
      <PrFlash
        visible={prVisible}
        onDismiss={() => setPrVisible(false)}
      />

      {/* Skip exercise confirm sheet */}
      <SkipConfirmSheet
        visible={showSkipExerciseConfirm}
        onConfirm={handleSkipExercise}
        onCancel={() => setShowSkipExerciseConfirm(false)}
      />
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
  sectionHdrWrap: {
    paddingHorizontal: 16,
    paddingTop: 18,
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
  nextExerciseCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  nextExerciseLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1 * 10,
    marginBottom: 6,
  },
  nextExerciseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextExerciseText: {
    flex: 1,
    minWidth: 0,
  },
  nextExerciseName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  nextExerciseMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  nextExerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
})
