import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Radius } from '@/constants/radius'
import { PendingRequestCard } from './PendingRequestCard'
import type { PendingRequest } from '@/stores/auth'

interface PendingSectionProps {
  requests: PendingRequest[]
  onCancel: (id: string) => void
}

export function PendingSection({ requests, onCancel }: PendingSectionProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  if (requests.length === 0) return null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.label }]}>{t('collab.pendingRequests')}</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.orange + '20' }]}>
          <Text style={[styles.countText, { color: colors.orange }]}>{requests.length}</Text>
        </View>
      </View>
      {requests.map((r) => (
        <PendingRequestCard key={r.id} request={r} onCancel={() => onCancel(r.id)} />
      ))}
      <View style={[styles.divider, { backgroundColor: colors.sep2 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginTop: 4,
    marginBottom: 12,
  },
})

export default PendingSection
