import React from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { goldAlpha, Brand } from '@/constants/colors'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'

export type RequestStatus = 'none' | 'pending' | 'active'

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'Osobní trenér': { bg: 'rgba(0,122,255,0.10)', text: '#007aff' },
  'Výž. poradce': { bg: 'rgba(52,199,89,0.10)', text: '#34c759' },
  'Výživový poradce': { bg: 'rgba(52,199,89,0.10)', text: '#34c759' },
  'Trenér & poradce': { bg: goldAlpha['10'], text: Brand.gold },
  Trainer: { bg: 'rgba(0,122,255,0.10)', text: '#007aff' },
  Nutritionist: { bg: 'rgba(52,199,89,0.10)', text: '#34c759' },
}

export interface TrainerCardData {
  id: string
  name: string
  role: string
  roles: string[]
  city: string
  rating: number
  reviewCount: number
  priceMonthly: string
  tags: string[]
  accepting: boolean
  avatarColor?: string
  avatarBg?: string
  /** Remote avatar image URL from the backend. When present, renders instead of initials. */
  avatarImageUrl?: string | null
}

interface TrainerCardProps {
  trainer: TrainerCardData
  requestStatus?: RequestStatus
  onProfilePress: () => void
  onContactPress: () => void
  onRevokePress?: () => void
}

export function TrainerCard({
  trainer,
  requestStatus = 'none',
  onProfilePress,
  onContactPress,
  onRevokePress,
}: TrainerCardProps) {
  const colors = useTheme()
  const { t } = useTranslation()

  const stars = '★'.repeat(Math.round(trainer.rating)) + '☆'.repeat(5 - Math.round(trainer.rating))

  const contactLabel = t('collab.contact')
  const contactDisabled = requestStatus === 'pending' || !trainer.accepting
  const waitlist = !trainer.accepting && requestStatus === 'none'

  return (
    <View style={[styles.card, { backgroundColor: colors.bg2 }]}>
      {/* Top section */}
      <View style={styles.top}>
        <Avatar name={trainer.name} size="md" color={trainer.avatarColor} imageUrl={trainer.avatarImageUrl} />
        <View style={styles.info}>
          <Text style={[Type.headline, { color: colors.label }]} numberOfLines={1}>
            {trainer.name}
          </Text>
          {trainer.city.length > 0 && (
            <Text style={[Type.subheadline, { color: colors.label2 }]} numberOfLines={1}>
              {trainer.city}
            </Text>
          )}
          <View style={styles.roleBadges}>
            {trainer.roles.map((r) => {
              const c = ROLE_BADGE_COLORS[r] ?? { bg: colors.fill, text: colors.label2 }
              return (
                <View key={r} style={[styles.roleBadge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.roleBadgeText, { color: c.text }]}>{r}</Text>
                </View>
              )
            })}
          </View>
          {trainer.rating > 0 && trainer.reviewCount > 0 && (
            <View style={styles.ratingRow}>
              <Text style={[styles.stars, { color: colors.orange }]}>{stars}</Text>
              <Text style={[Type.caption1, { color: colors.label2 }]}>
                {trainer.rating} ({trainer.reviewCount})
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.sep2 }]}>
        <View style={styles.priceBlock}>
          {trainer.priceMonthly ? (
            <>
              <Text style={[styles.priceValue, { color: colors.gold }]} numberOfLines={1}>
                {trainer.priceMonthly}
              </Text>
              <Text style={[styles.priceUnit, { color: colors.gold }]}>
                {t('collab.pricePerMonth')}
              </Text>
            </>
          ) : (
            <Text style={[styles.priceUnit, { color: colors.label3 }]}>
              {t('collab.priceOnRequest')}
            </Text>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={onProfilePress}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.label }]}>{t('collab.profile')}</Text>
          </Pressable>

          {requestStatus === 'none' && (
            <Pressable
              onPress={onContactPress}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.actionText, { color: colors.onAccent }]}>
                {contactLabel}
              </Text>
            </Pressable>
          )}
          {requestStatus === 'pending' && (
            <Pressable
              onPress={onRevokePress}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: 'rgba(255,59,48,0.08)', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.actionText, { color: colors.red }]}>
                {t('collab.cancelRequest')}
              </Text>
            </Pressable>
          )}
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
    gap: 12,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  roleBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stars: {
    fontSize: 12,
    letterSpacing: 1,
  },
  priceBlock: {
    flexShrink: 1,
    marginRight: 8,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: '500',
  },
  tagsScroll: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
  },
  actionText: {
    ...Type.subheadline,
    fontWeight: '600',
  },
})

export default TrainerCard
