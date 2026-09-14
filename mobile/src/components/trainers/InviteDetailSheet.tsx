import React, { useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Badge } from '@/components/ui/Badge'
import type { ClientRequestDto } from '@/api/professionals'

interface InviteDetailSheetProps {
  visible: boolean
  request: ClientRequestDto | null
  professionalName: string
  onClose: () => void
  onRevoke: (publicId: string) => void
  isRevoking: boolean
}

export function InviteDetailSheet({
  visible,
  request,
  professionalName,
  onClose,
  onRevoke,
  isRevoking,
}: InviteDetailSheetProps) {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const requestRef = useRef(request)
  const nameRef = useRef(professionalName)

  if (request) { requestRef.current = request; nameRef.current = professionalName }

  const req = requestRef.current
  if (!req) return null

  const isPending = req.status === 'Pending'
  const badgeVariant = req.status === 'Accepted' ? 'active' as const
    : req.status === 'Rejected' ? 'warning' as const
    : req.status === 'Cancelled' ? 'inactive' as const
    : 'gold' as const

  const sentDate = new Date(req.sentAt ?? 0).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Invite Detail"
    >
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[Type.caption1, { color: colors.label3 }]}>Coach</Text>
          <Text style={[Type.headline, { color: colors.label }]}>{nameRef.current}</Text>
        </View>

        <View style={styles.row}>
          <Text style={[Type.caption1, { color: colors.label3 }]}>Status</Text>
          <Badge label={req.status ?? ''} variant={badgeVariant} />
        </View>

        <View style={styles.row}>
          <Text style={[Type.caption1, { color: colors.label3 }]}>Sent</Text>
          <Text style={[Type.subheadline, { color: colors.label }]}>{sentDate}</Text>
        </View>

        {req.message && (
          <View style={styles.row}>
            <Text style={[Type.caption1, { color: colors.label3 }]}>Your message</Text>
            <Text style={[Type.subheadline, { color: colors.label2, marginTop: 4 }]}>
              {req.message}
            </Text>
          </View>
        )}
      </View>

      {isPending && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onRevoke(req.publicId ?? '')}
            disabled={isRevoking}
            style={[styles.revokeBtn, { backgroundColor: colors.red + '18' }]}
          >
            <Text style={[styles.revokeText, { color: colors.red }]}>
              {isRevoking ? 'Revoking...' : 'Revoke Invitation'}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={{ height: insets.bottom + 60 }} />
    </BottomSheet>
  )
}

export default InviteDetailSheet

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  row: {
    gap: 4,
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  revokeBtn: {
    paddingVertical: 14,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  revokeText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
