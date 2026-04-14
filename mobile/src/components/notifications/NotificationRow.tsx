import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha } from '@/constants/colors'
import type { Notification } from '@/hooks/useNotifications'

const NOTIF_CONFIG: Record<Notification['type'], {
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  invitation:    { bg: goldAlpha['12'], icon: 'person-add',       color: '#c9a84c' },
  questionnaire: { bg: goldAlpha['12'], icon: 'clipboard',        color: '#c9a84c' },
  new_plan:      { bg: 'rgba(11,110,153,0.10)', icon: 'calendar',        color: '#0b6e99' },
  message:       { bg: 'rgba(0,122,255,0.10)',  icon: 'chatbubble',      color: '#007aff' },
  training_done: { bg: 'rgba(52,199,89,0.10)',  icon: 'checkmark-circle', color: '#34c759' },
  alarm:         { bg: 'rgba(255,59,48,0.10)',  icon: 'alert-circle',     color: '#ff3b30' },
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

interface NotificationRowProps {
  notification: Notification
  onAction: (notification: Notification) => void
  onDismiss: (notification: Notification) => void
}

export const NotificationRow = React.memo(function NotificationRow({ notification, onAction, onDismiss }: NotificationRowProps) {
  const colors = useTheme()
  const { type, title, body, timestamp, read, actionLabel } = notification

  return (
    <View
      style={[
        styles.row,
        !read && { backgroundColor: goldAlpha['04'] },
      ]}
    >
      <View style={styles.dotCol}>
        {!read && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[Type.headline, { color: colors.label, flex: 1 }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[Type.caption1, { color: colors.label3 }]}>
            {timeAgo(timestamp)}
          </Text>
        </View>
        <Text style={[Type.subheadline, { color: colors.label2, marginTop: 2 }]} numberOfLines={2}>
          {body}
        </Text>

      </View>
    </View>
  )
})

export default NotificationRow

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 16,
    paddingVertical: 12,
  },
  dotCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9a84c',
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
  },
  actionTextPrimary: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextSecondary: {
    fontSize: 13,
    fontWeight: '500',
  },
})
