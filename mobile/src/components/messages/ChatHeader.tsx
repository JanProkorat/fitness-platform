import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { goldAlpha } from '@/constants/colors'
import { getInitials } from '@/lib/initials'
import type { Participant } from '../../types/messages'

interface ChatHeaderProps {
  participant: Participant
  onBack: () => void
  onInfoPress: () => void
}

export function ChatHeader({ participant, onBack, onInfoPress }: ChatHeaderProps) {
  const colors = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.inner, { borderBottomColor: colors.sep2 }]}>
        {/* Left: Back button */}
        <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={colors.gold} />
          <Text style={{ fontSize: 16, color: colors.gold, marginLeft: 2 }}>Messages</Text>
        </Pressable>

        {/* Center: Avatar + name + status — stacked vertically */}
        <View style={styles.center}>
          <View style={[styles.avatar, { backgroundColor: goldAlpha['15'] }]}>
            <Text style={[styles.avatarText, { color: colors.gold }]}>
              {getInitials(participant.name)}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.label }]} numberOfLines={1}>
            {participant.name}
          </Text>
          <Text style={[styles.status, { color: participant.online ? colors.green : colors.label2 }]}>
            {participant.online ? '● Online' : '● Offline'}
          </Text>
        </View>

        {/* Right: Action buttons in circles */}
        <View style={styles.rightActions}>
          <Pressable onPress={onInfoPress} style={[styles.actionBtn, { backgroundColor: colors.fill }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.blue} />
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  status: {
    fontSize: 12,
    marginTop: 2,
  },
  rightActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    width: 100,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default ChatHeader
