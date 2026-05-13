import React from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { useTranslation } from 'react-i18next'
import { formatSeconds } from './liveTrainingHelpers'

interface LiveSessionHeaderProps {
  /** Session display name. */
  sessionName: string
  /**
   * Currently active workout (section) name. Only rendered in the running
   * layout (when `isPreStart` is false). On pre-start the title row shows the
   * session name beneath the static "AKTIVNÍ TRÉNINK" eyebrow instead.
   */
  workoutName: string
  elapsedSeconds: number
  /** 1-based index of the currently active workout among the session's workouts. */
  workoutsCurrent: number
  workoutsTotal: number
  /**
   * When true the header is in pre-start mode:
   *   - eyebrow = static "AKTIVNÍ TRÉNINK" label
   *   - title   = sessionName
   *   - progress = `0 / N workoutů` (nothing active yet)
   * When false the header is in running/finished mode:
   *   - eyebrow = sessionName
   *   - title   = workoutName (currently active workout)
   *   - progress = `current / total workoutů` (1-based position-in-line)
   */
  isPreStart?: boolean
  onClose: () => void
  /** When true the close button shows a spinner and is disabled (flush in-flight). */
  closePending?: boolean
}

/**
 * Top bar shown during a live training session.
 * Contains: close button, session name + active workout name, elapsed timer,
 * workouts position pill ("3 / 5 workoutů" — current-in-line, NOT finished count).
 */
export function LiveSessionHeader({
  sessionName,
  workoutName,
  elapsedSeconds,
  workoutsCurrent,
  workoutsTotal,
  isPreStart = false,
  onClose,
  closePending = false,
}: LiveSessionHeaderProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg2, borderBottomColor: colors.sep2 },
      ]}
    >
      {/* Close button — disabled while the final PUT is in-flight */}
      <Pressable
        onPress={closePending ? undefined : onClose}
        disabled={closePending}
        style={[styles.closeBtn, { backgroundColor: colors.fill }]}
        accessibilityLabel={t('common.back')}
      >
        {closePending ? (
          <ActivityIndicator size="small" color={colors.label} />
        ) : (
          <Ionicons name="close" size={16} color={colors.label2} />
        )}
      </Pressable>

      {/* Eyebrow + title — branches on isPreStart (see prop docstring). */}
      <View style={styles.titleWrap}>
        <Text
          style={[styles.eyebrow, { color: colors.label3 }]}
          numberOfLines={1}
        >
          {isPreStart ? t('training.live.activeLabel') : sessionName}
        </Text>
        <Text
          style={[styles.sessionName, { color: colors.label }]}
          numberOfLines={1}
        >
          {isPreStart ? sessionName : workoutName}
        </Text>
      </View>

      {/* Elapsed + workouts progress (0/N on prestart, current/total when running) */}
      <View style={styles.statsWrap}>
        <Text style={[styles.elapsed, { color: colors.gold }]}>
          {formatSeconds(elapsedSeconds)}
        </Text>
        <Text style={[styles.setsProgress, { color: colors.label3 }]}>
          {t('training.live.workoutsProgress', {
            done: isPreStart ? 0 : workoutsCurrent,
            total: workoutsTotal,
          })}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.12 * 10,
  },
  sessionName: {
    ...Type.callout,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: 1,
  },
  statsWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  elapsed: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  setsProgress: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
})

export default LiveSessionHeader
