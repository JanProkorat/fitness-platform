import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { cardShadow } from '@/constants/shadows'
import { Avatar } from '@/components/ui/Avatar'
import type { TrainerInvite } from '@/hooks/useClientInvite'

interface InviteCardProps {
  invite: TrainerInvite
  onViewInvite: () => void
}

// #814 — Accept/Decline moved to the invite detail screen only; this card is
// now a read-only summary + single CTA. That also removes the old
// exit-collapse animation entirely (nothing inside the card triggers
// dismissal anymore — the card just unmounts when `invite` goes null after
// the user decides on the detail screen).
//
// #812 — the entrance animation now runs fully on the native (UI) thread
// (`useNativeDriver: true`) and only ever touches `opacity`/`transform`,
// neither of which Yoga includes in layout measurement. Previously the
// wrapper also carried a JS-driven (`useNativeDriver: false`) `maxHeight`
// Animated.Value pinned at a constant 300 — since transform/opacity updates
// on the JS thread are applied via imperative native-prop patches rather
// than a normal Yoga re-layout, that combination risked the wrapper's
// reserved height lagging behind its true rendered content size on first
// mount, which could clip into the `StatStrip` row rendered right after it
// in the Today ScrollView. Dropping the maxHeight cap (dead weight now that
// the collapse animation is gone) and native-driving the remaining
// transform/opacity means Yoga always measures the card's real content
// height up front, so `StatStrip` is reliably positioned below it.
export function InviteCard({ invite, onViewInvite }: InviteCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-40)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bg2,
            borderColor: goldAlpha['25'],
            shadowColor: colors.gold,
          },
        ]}
      >
        {/* Trainer info */}
        <View style={styles.trainerRow}>
          <Avatar name={invite.trainerName} size="md" />
          <View style={styles.trainerInfo}>
            <Text style={[Type.headline, { color: colors.label }]}>
              {invite.trainerName}
            </Text>
            <Text style={[Type.caption1, { color: colors.label2 }]}>
              {invite.trainerRole}{invite.trainerCity ? ` · ${invite.trainerCity}` : ''}
            </Text>
          </View>
          <Pressable
            style={[styles.viewInviteBtn, { backgroundColor: colors.gold }]}
            onPress={onViewInvite}
            hitSlop={4}
          >
            <Text style={[styles.viewInviteText, { color: colors.onAccent }]}>
              {t('collab.viewInvite')}
            </Text>
          </Pressable>
        </View>

        {/* Invite text — personal message now lives in the chat */}
        <Text style={[Type.subheadline, { color: colors.label2, marginTop: 10 }]}>
          {t('today.inviteCard.subtitle', { name: invite.trainerName })}
        </Text>
      </View>
    </Animated.View>
  )
}

export default InviteCard

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: 16,
    ...cardShadow,
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewInviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginLeft: 8,
  },
  viewInviteText: {
    fontSize: 13,
    fontWeight: '600',
  },
})
