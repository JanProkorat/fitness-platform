import React, { useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Avatar } from '@/components/ui/Avatar'
import { formatTimestamp } from '@/lib/dateFormatting'
import type { ConversationDto } from '../../api/generated'

interface ConversationRowProps {
  conversation: ConversationDto
  onPress: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  variant?: 'default' | 'archived'
}

export const ConversationRow = React.memo(function ConversationRow({
  conversation,
  onPress,
  onArchive,
  onUnarchive,
  variant = 'default',
}: ConversationRowProps) {
  const colors = useTheme()
  const swipeRef = useRef<Swipeable>(null)
  const { participant, lastMessage, lastMessageIsOwn, lastMessageAt, unreadCount } = conversation
  const hasUnread = (unreadCount ?? 0) > 0
  const isArchived = variant === 'archived'

  const preview = lastMessageIsOwn ? `You: ${lastMessage ?? ''}` : (lastMessage ?? '')

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    })

    const isUnarchiveAction = isArchived && onUnarchive
    const actionColor = isUnarchiveAction ? colors.green : colors.systemGray
    const actionLabel = isUnarchiveAction ? 'Unarchive' : 'Archive'
    const actionHandler = isUnarchiveAction ? onUnarchive : onArchive

    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close()
          actionHandler?.()
        }}
        style={[styles.swipeAction, { backgroundColor: actionColor }]}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center', gap: 3 }}>
          <Ionicons name="archive-outline" size={18} color={colors.onAccent} />
          <Text style={[styles.swipeLabel, { color: colors.onAccent }]}>{actionLabel}</Text>
        </Animated.View>
      </Pressable>
    )
  }

  const content = (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.fill2 : colors.bg2 },
      ]}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={[styles.avatarWrap, { opacity: isArchived ? 0.6 : 1 }]}>
        <Avatar name={participant?.name ?? ''} size="md" />
        {!isArchived && participant?.online && (
          <View style={[styles.onlineDot, { borderColor: colors.bg2, backgroundColor: colors.green }]} />
        )}
      </View>

      {/* Body */}
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, { color: isArchived ? colors.label2 : colors.label, opacity: isArchived ? 0.7 : 1 }]}
            numberOfLines={1}
          >
            {participant?.name ?? ''}
          </Text>
          {isArchived && (
            <View style={[styles.badge, { backgroundColor: colors.fill }]}>
              <Text style={[styles.badgeText, { color: colors.label3 }]}>archived</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.preview,
            {
              color: isArchived ? colors.label3 : hasUnread ? colors.label : colors.label2,
              fontWeight: !isArchived && hasUnread ? '500' : '400',
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
          {formatTimestamp(lastMessageAt ?? '')}
        </Text>
        {!isArchived && hasUnread && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.gold }]}>
            <Text style={[styles.unreadText, { color: colors.onAccent }]}>
              {(unreadCount ?? 0) > 99 ? '99+' : (unreadCount ?? 0)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  )

  if (onArchive || onUnarchive) {
    return (
      <Swipeable
        ref={swipeRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        {content}
      </Swipeable>
    )
  }

  return content
})

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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '500',
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
    fontSize: 12,
    fontWeight: '700',
  },
  swipeAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
})

export default ConversationRow
