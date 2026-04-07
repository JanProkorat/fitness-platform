import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import type { Notification } from '@/hooks/useNotifications'

const NOTIF_ICON_BG: Record<Notification['type'], string> = {
  invitation: 'rgba(201,168,76,0.12)',
  questionnaire: 'rgba(201,168,76,0.12)',
  new_plan: 'rgba(11,110,153,0.10)',
  message: 'rgba(0,122,255,0.10)',
  training_done: 'rgba(52,199,89,0.10)',
  alarm: 'rgba(255,59,48,0.10)',
}

const NOTIF_ICON: Record<Notification['type'], keyof typeof Ionicons.glyphMap> = {
  invitation: 'person-add',
  questionnaire: 'clipboard',
  new_plan: 'calendar',
  message: 'chatbubble',
  training_done: 'checkmark-circle',
  alarm: 'alert-circle',
}

const NOTIF_ICON_COLOR: Record<Notification['type'], string> = {
  invitation: '#c9a84c',
  questionnaire: '#c9a84c',
  new_plan: '#0b6e99',
  message: '#007aff',
  training_done: '#34c759',
  alarm: '#ff3b30',
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

export function NotificationRow({ notification, onAction, onDismiss }: NotificationRowProps) {
  const colors = useTheme()
  const { type, title, body, timestamp, read, actionLabel } = notification

  return (
    <View
      style={[
        styles.row,
        !read && { backgroundColor: 'rgba(201,168,76,0.04)' },
      ]}
    >
      {!read && <View style={styles.unreadDot} />}

      <View style={[styles.icon, { backgroundColor: NOTIF_ICON_BG[type] }]}>
        <Ionicons name={NOTIF_ICON[type]} size={22} color={NOTIF_ICON_COLOR[type]} />
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
}

export default NotificationRow

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c9a84c',
    marginTop: 18,
    marginRight: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextSecondary: {
    fontSize: 13,
    fontWeight: '500',
  },
})
