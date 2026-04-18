import React, { useCallback } from 'react'
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useTranslation } from 'react-i18next'
import { useLiveSessionStore } from '@/stores/liveSessionStore'

interface ResumeTrainingBannerProps {
  /** Exercise name at the current position in the session */
  exerciseName: string
  /** 1-based set number at the current position */
  setNumber: number
  onResume: () => void
}

/**
 * Banner shown on the Today screen when there is a paused live session.
 * Offers "Pokračovat" and "Zahodit" actions.
 * Rendered by HasTrainerState when liveSessionStore.hasActiveSession() is true.
 */
export function ResumeTrainingBanner({
  exerciseName,
  setNumber,
  onResume,
}: ResumeTrainingBannerProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const discard = useLiveSessionStore((s) => s.discard)

  const handleDiscard = useCallback(() => {
    Alert.alert(
      t('training.live.discardTitle'),
      t('training.live.discardMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('training.live.discardConfirm'),
          style: 'destructive',
          onPress: () => discard(),
        },
      ],
    )
  }, [t, discard])

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.bg2,
          borderColor: colors.gold,
        },
      ]}
    >
      {/* Play icon */}
      <View style={[styles.iconWrap, { backgroundColor: colors.goldBg }]}>
        <Text style={[styles.icon, { color: colors.gold }]}>▶</Text>
      </View>

      {/* Label */}
      <View style={styles.labelWrap}>
        <Text style={[styles.primary, { color: colors.label }]}>
          {t('training.live.resumeLabel')}
        </Text>
        <Text style={[styles.secondary, { color: colors.label2 }]} numberOfLines={1}>
          {t('training.live.resumeMeta', { exercise: exerciseName, set: setNumber })}
        </Text>
      </View>

      {/* Pokračovat button */}
      <Pressable
        style={[styles.continueBtn, { backgroundColor: colors.gold }]}
        onPress={onResume}
        accessibilityLabel={t('training.live.resumeLabel')}
      >
        <Text style={[styles.continueBtnText, { color: colors.onAccent }]}>
          {t('training.live.resumeContinue')}
        </Text>
      </Pressable>

      {/* Zahodit */}
      <Pressable onPress={handleDiscard} style={styles.discardBtn}>
        <Text style={[styles.discardBtnText, { color: colors.label3 }]}>
          {t('training.live.discardBtn')}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: Radius.sm,
    padding: 12,
    paddingRight: 14,
    marginHorizontal: 16,
    marginTop: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 18,
  },
  labelWrap: {
    flex: 1,
    minWidth: 0,
  },
  primary: {
    ...Type.subheadline,
    fontWeight: '600',
    lineHeight: 20,
  },
  secondary: {
    ...Type.caption1,
    marginTop: 2,
  },
  continueBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    flexShrink: 0,
  },
  continueBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  discardBtn: {
    padding: 6,
    flexShrink: 0,
  },
  discardBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
})

export default ResumeTrainingBanner
