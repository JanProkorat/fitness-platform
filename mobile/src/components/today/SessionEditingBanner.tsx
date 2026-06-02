/**
 * SessionEditingBanner — gold warning banner shown when a session's LockState
 * is "Editing" (a trainer currently holds the edit lock).
 *
 * AC (a) — spec §9: cosmetic warning banner only.
 * The Start button STAYS TAPPABLE — this is NOT a hard block.
 * Banner hidden for "Stable", "Live", or missing lock state (treated as Stable).
 */
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { goldAlpha } from '@/constants/colors'

interface SessionEditingBannerProps {
  /** Session edit-lock state from the backend. Banner renders only when "Editing". */
  lockState?: string | undefined
}

export function SessionEditingBanner({ lockState }: SessionEditingBannerProps) {
  const { t } = useTranslation()
  const colors = useTheme()

  // Banner is only shown while state is explicitly "Editing".
  // "Stable", "Live", null, undefined → hidden.
  if (lockState !== 'Editing') return null

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: goldAlpha['12'],
          borderColor: goldAlpha['35'],
        },
      ]}
    >
      <Ionicons name="warning-outline" size={16} color={colors.gold} style={styles.icon} />
      <Text style={[styles.text, { color: colors.gold }]}>
        {t('training.sessionEditing.bannerMessage')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    gap: 8,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    ...Type.footnote,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },
})

export default SessionEditingBanner
