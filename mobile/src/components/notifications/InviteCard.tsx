import React, { useRef, useCallback, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { cardShadow } from '@/constants/shadows'
import { Avatar } from '@/components/ui/Avatar'
import type { TrainerInvite } from '@/hooks/useClientInvite'

interface InviteCardProps {
  invite: TrainerInvite
  onAccept: () => void
  onDecline: () => void
}

export function InviteCard({ invite, onAccept, onDecline }: InviteCardProps) {
  const colors = useTheme()
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-40)).current
  const maxHeight = useRef(new Animated.Value(300)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 200,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start()
  }, [])

  const animateOut = useCallback(
    (callback: () => void) => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.timing(maxHeight, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
      ]).start(() => callback())
    },
    [opacity, maxHeight],
  )

  return (
    <Animated.View style={[styles.wrapper, { opacity, maxHeight, transform: [{ translateY }] }]}>
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
              {invite.trainerRole}{invite.trainerCity ? ` \u00b7 ${invite.trainerCity}` : ''}
            </Text>
          </View>
        </View>

        {/* Invite text — personal message now lives in the chat */}
        <Text style={[Type.subheadline, { color: colors.label2, marginTop: 10 }]}>
          {invite.trainerName} invites you to collaborate
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.gold, flex: 1 }]}
            onPress={() => animateOut(onAccept)}
          >
            <Text style={[styles.btnTextPrimary, { color: colors.onAccent }]}>Accept invitation</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.fill, flex: 1 }]}
            onPress={() => animateOut(onDecline)}
          >
            <Text style={[styles.btnTextSecondary, { color: colors.label2 }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

export default InviteCard

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
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
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  btnTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
  },
  btnTextSecondary: {
    fontSize: 15,
    fontWeight: '500',
  },
})
