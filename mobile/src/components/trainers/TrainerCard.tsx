import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { GoldButton } from '@/components/ui/GoldButton'
import { SecondaryButton } from '@/components/ui/SecondaryButton'
import type { ProfessionalSummary } from '@/api/professionals'

interface TrainerCardProps {
  professional: ProfessionalSummary
  onProfile: () => void
  onContact: () => void
  contactDisabled?: boolean
  contactLabel?: string
}

export function TrainerCard({
  professional,
  onProfile,
  onContact,
  contactDisabled,
  contactLabel = 'Contact',
}: TrainerCardProps) {
  const colors = useTheme()
  const fullName = `${professional.firstName} ${professional.lastName}`
  const roles = professional.roles?.length
    ? professional.roles
    : professional.role
      ? [professional.role]
      : []
  const roleLabel = roles.join(' & ')

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Top section */}
      <View style={styles.top}>
        <Avatar name={fullName} size="md" />
        <View style={styles.info}>
          <Text style={[Type.headline, { color: colors.label }]} numberOfLines={1}>
            {fullName}
          </Text>
          <Text style={[Type.subheadline, { color: colors.label2 }]} numberOfLines={1}>
            {roleLabel}
            {professional.city ? ` · ${professional.city}` : ''}
          </Text>
          {professional.estimatedPrice && (
            <Text style={[styles.price, { color: colors.gold }]}>
              {professional.estimatedPrice}
            </Text>
          )}
        </View>
      </View>

      {/* Specialization tags */}
      {professional.specializations.length > 0 && (
        <View style={[styles.tags, { borderTopColor: colors.sep2 }]}>
          {professional.specializations.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.fill }]}>
              <Text style={[styles.tagText, { color: colors.label2 }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.sep2 }]}>
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: colors.green }]} />
          <Text style={[Type.caption1, { color: colors.label3 }]}>Accepting clients</Text>
        </View>
        <View style={styles.actions}>
          <SecondaryButton title="Profile" onPress={onProfile} style={styles.actionBtn} />
          <GoldButton
            title={contactLabel}
            onPress={onContact}
            disabled={contactDisabled}
            style={styles.actionBtn}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: 12,
  },
  top: {
    flexDirection: 'row',
    padding: 16,
    gap: 14,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  price: {
    ...Type.caption1,
    fontWeight: '600',
    marginTop: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  tagText: {
    ...Type.caption1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    height: 36,
    paddingHorizontal: 14,
  },
})

export default TrainerCard
