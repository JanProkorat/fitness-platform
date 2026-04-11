import React from 'react'
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import type { PendingRequest } from '@/stores/auth'

interface PendingRequestCardProps {
  request: PendingRequest
  onCancel: () => void
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function PendingRequestCard({ request, onCancel }: PendingRequestCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      <View style={styles.top}>
        <Avatar name={request.name} size="sm" color={request.avatarColor} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.label }]}>{request.name}</Text>
          <Text style={[styles.role, { color: colors.label2 }]}>
            {request.role} · {request.city}
          </Text>
          <Text style={[styles.sentAt, { color: colors.label3 }]}>
            {t('collab.sentAgo', { time: timeAgo(request.sentAt) })}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.orange + '20' }]}>
          <Text style={[styles.badgeText, { color: colors.orange }]}>{t('collab.waiting')}</Text>
        </View>
      </View>
      <View style={[styles.footer, { borderTopColor: colors.sep2 }]}>
        <Text style={[styles.footerHint, { color: colors.label3 }]}>
          {t('collab.usuallyRespond')}
        </Text>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={[styles.cancelText, { color: colors.red }]}>{t('collab.cancelRequest')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,149,0,0.2)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  role: {
    fontSize: 12,
    marginTop: 1,
  },
  sentAt: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerHint: {
    ...Type.caption1,
  },
  cancelText: {
    ...Type.caption1,
    fontWeight: '600',
  },
})

export default PendingRequestCard
