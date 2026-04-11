import React from 'react'
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import type { ActiveCollaborator } from '@/stores/auth'

interface CollabStats {
  compliancePercent: number
  progressLabel: string
  planWeek: string
}

interface ActiveCollaboratorCardProps {
  collaborator: ActiveCollaborator
  stats?: CollabStats
  onProfilePress: () => void
  onMessagePress: () => void
  onEndCollaboration: () => void
}

export function ActiveCollaboratorCard({
  collaborator,
  stats,
  onProfilePress,
  onMessagePress,
  onEndCollaboration,
}: ActiveCollaboratorCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const handleEnd = () => {
    Alert.alert(
      t('collab.endCollabTitle'),
      t('collab.endCollabMessage', { name: collaborator.name }),
      [
        { text: t('collab.endCollabCancel'), style: 'cancel' },
        { text: t('collab.endCollabConfirm'), style: 'destructive', onPress: onEndCollaboration },
      ],
    )
  }

  const sinceDate = new Date(collaborator.since)
  const sinceLabel = `od ${sinceDate.getDate()}. ${sinceDate.getMonth() + 1}. ${sinceDate.getFullYear()}`

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Header row */}
      <View style={styles.header}>
        <Avatar name={collaborator.name} size="sm" color={collaborator.avatarColor} />
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.label }]}>{collaborator.name}</Text>
          <Text style={[styles.role, { color: colors.label2 }]}>
            {collaborator.role} · {sinceLabel}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.green + '20' }]}>
          <Text style={[styles.badgeText, { color: colors.green }]}>{t('collab.active')}</Text>
        </View>
      </View>

      {/* Stats strip (state D only) */}
      {stats && (
        <View style={[styles.statsStrip, { borderTopColor: colors.sep2 }]}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.green }]}>
              {stats.compliancePercent} %
            </Text>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>Compliance</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.label }]}>
              {stats.progressLabel}
            </Text>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>Pokrok</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.sep2 }]} />
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.label }]}>
              {stats.planWeek}
            </Text>
            <Text style={[styles.statLabel, { color: colors.label3 }]}>Týden</Text>
          </View>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          onPress={onProfilePress}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.label2 }]}>{t('collab.profile')}</Text>
        </Pressable>
        <Pressable
          onPress={onMessagePress}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.label2 }]}>{t('collab.message')}</Text>
        </Pressable>
        <Pressable
          onPress={handleEnd}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: 'rgba(255,59,48,0.08)', opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.actionText, { color: colors.red }]}>{t('collab.endCollab')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const AVATAR_SIZE = 46

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 0,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  role: {
    ...Type.caption1,
    marginTop: 1,
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
  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  // Actions
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  actionText: {
    ...Type.caption1,
    fontWeight: '500',
  },
})

export default ActiveCollaboratorCard
