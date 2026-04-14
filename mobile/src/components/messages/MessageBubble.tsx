import React from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { goldAlpha } from '@/constants/colors'
import { getInitials } from '@/lib/initials'
import { formatTime } from '@/lib/dateFormatting'
import type { Message } from '../../types/messages'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showAvatar: boolean
  participantName?: string
  onRetry?: (id: string) => void
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  participantName = '',
  onRetry,
}: MessageBubbleProps) {
  const colors = useTheme()
  const isError = message.status === 'error'
  const isSending = message.status === 'sending'

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowTheirs]}>
      {/* Avatar slot for received messages */}
      {!isOwn && (
        showAvatar ? (
          <View style={[styles.tinyAvatar, { backgroundColor: goldAlpha['15'] }]}>
            <Text style={[styles.tinyAvatarText, { color: colors.gold }]}>
              {getInitials(participantName)}
            </Text>
          </View>
        ) : (
          <View style={styles.avatarSpacer} />
        )
      )}

      <View style={styles.bubbleWrap}>
        <View
          style={[
            styles.bubble,
            isOwn
              ? [styles.bubbleOwn, { backgroundColor: colors.gold }]
              : [
                  styles.bubbleTheirs,
                  {
                    backgroundColor: colors.bg2,
                    ...Platform.select({
                      ios: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.06,
                        shadowRadius: 2,
                      },
                      android: { elevation: 1 },
                    }),
                  },
                ],
            isError && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isOwn ? colors.onAccent : colors.label }]}>
            {message.text}
          </Text>
          {/* Timestamp inside bubble area */}
          <View style={[styles.timeRow, isOwn && styles.timeRowOwn]}>
            {isSending ? (
              <Text style={[styles.timeText, { color: colors.label3 }]}>Sending...</Text>
            ) : isError ? (
              <Pressable onPress={() => onRetry?.(message.id)} style={styles.retryRow}>
                <Ionicons name="alert-circle" size={12} color={colors.red} />
                <Text style={[styles.timeText, { color: colors.red }]}>Failed · Retry</Text>
              </Pressable>
            ) : (
              <>
                <Text
                  style={[
                    styles.timeText,
                    { color: isOwn ? colors.onAccent : colors.label3, opacity: isOwn ? 0.65 : 1 },
                  ]}
                >
                  {formatTime(message.timestamp)}
                </Text>
                {isOwn && message.isRead && (
                  <Ionicons
                    name="checkmark-done"
                    size={14}
                    color={colors.onAccent}
                    style={{ marginLeft: 3, opacity: 0.6 }}
                  />
                )}
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 1,
    gap: 6,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  tinyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
    flexShrink: 0,
  },
  tinyAvatarText: {
    fontSize: 10,
    fontWeight: '700',
  },
  avatarSpacer: {
    width: 26,
    flexShrink: 0,
  },
  bubbleWrap: {
    maxWidth: 240,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 6,
    borderRadius: 18,
  },
  bubbleOwn: {
    borderBottomRightRadius: 5,
  },
  bubbleTheirs: {
    borderBottomLeftRadius: 5,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  timeRowOwn: {
    justifyContent: 'flex-end',
  },
  timeText: {
    fontSize: 10,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
})

export default MessageBubble
