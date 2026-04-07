import React, { useCallback } from 'react'
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import type { Conversation } from '../../types/messages'

interface ConversationRowProps {
  conversation: Conversation
  onPress: () => void
  onArchive?: () => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return (parts[0]?.[0] ?? '').toUpperCase()
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function ConversationRow({ conversation, onPress, onArchive }: ConversationRowProps) {
  const colors = useTheme()
  const { participant, lastMessage, lastMessageIsOwn, lastMessageAt, unreadCount } = conversation
  const hasUnread = unreadCount > 0

  const preview = lastMessageIsOwn
    ? `You: ${lastMessage}`
    : lastMessage

  const handleLongPress = useCallback(() => {
    if (!onArchive) return
    Alert.alert(
      'Archive conversation',
      `Archive your chat with ${participant.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', style: 'destructive', onPress: onArchive },
      ],
    )
  }, [onArchive, participant.name])

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.fill2 : colors.bg2 },
      ]}
      onPress={onPress}
      onLongPress={handleLongPress}
    >
      {/* Avatar with online dot */}
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(201,168,76,0.15)' }]}>
          <Text style={[styles.avatarText, { color: colors.gold }]}>
            {getInitials(participant.name)}
          </Text>
        </View>
        {participant.online && (
          <View style={[styles.onlineDot, { borderColor: colors.bg2, backgroundColor: colors.green }]} />
        )}
      </View>

      {/* Body column */}
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.label }]} numberOfLines={1}>
          {participant.name}
        </Text>
        <Text
          style={[
            styles.preview,
            {
              color: hasUnread ? colors.label : colors.label2,
              fontWeight: hasUnread ? '500' : '400',
            },
          ]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      {/* Right column */}
      <View style={styles.rightCol}>
        <Text style={[styles.time, { color: colors.label3 }]}>
          {formatTimestamp(lastMessageAt)}
        </Text>
        {hasUnread && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.unreadText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatarWrap: {
    width: 50,
    height: 50,
    flexShrink: 0,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 19,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  preview: {
    fontSize: 14,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 5,
    flexShrink: 0,
  },
  time: {
    fontSize: 12,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
})

export default ConversationRow
