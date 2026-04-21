import React from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { useTranslation } from 'react-i18next'
import { formatSeconds } from './liveTrainingHelpers'

interface LiveSessionHeaderProps {
  sessionName: string
  elapsedSeconds: number
  setsDone: number
  setsTotal: number
  onClose: () => void
  /** When true the close button shows a spinner and is disabled (flush in-flight). */
  closePending?: boolean
}

/**
 * Top bar shown during a live training session.
 * Contains: close button, plan/session name, elapsed timer, sets progress pill.
 */
export function LiveSessionHeader({
  sessionName,
  elapsedSeconds,
  setsDone,
  setsTotal,
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

      {/* Session label + name */}
      <View style={styles.titleWrap}>
        <Text style={[styles.eyebrow, { color: colors.label3 }]}>
          {t('training.live.activeLabel')}
        </Text>
        <Text
          style={[styles.sessionName, { color: colors.label }]}
          numberOfLines={1}
        >
          {sessionName}
        </Text>
      </View>

      {/* Elapsed + sets progress */}
      <View style={styles.statsWrap}>
        <Text style={[styles.elapsed, { color: colors.gold }]}>
          {formatSeconds(elapsedSeconds)}
        </Text>
        <Text style={[styles.setsProgress, { color: colors.label3 }]}>
          {t('training.live.setsProgress', { done: setsDone, total: setsTotal })}
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
