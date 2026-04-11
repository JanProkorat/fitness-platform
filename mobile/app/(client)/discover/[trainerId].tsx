import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { getProfessionalProfile, type ProfessionalProfile } from '@/api/professionals'
import { useAuthStore } from '@/stores/auth'
import { useCollaboration } from '@/hooks/useCollaboration'
import { SendInviteSheet, type InviteTarget } from '@/components/trainers/SendInviteSheet'

const SPEC_COLORS: Record<string, { bg: string; text: string }> = {
  'Silový trénink': { bg: 'rgba(11,110,153,0.08)', text: '#0b6e99' },
  'HIIT': { bg: 'rgba(173,87,0,0.08)', text: '#ad5700' },
  'Výživa': { bg: 'rgba(52,199,89,0.08)', text: '#34c759' },
  'Hubnutí': { bg: 'rgba(175,82,222,0.08)', text: '#af52de' },
  'Rekomposice': { bg: 'rgba(0,122,255,0.08)', text: '#007aff' },
  'Online': { bg: 'rgba(120,120,128,0.08)', text: '#8e8e93' },
  'Nabírání': { bg: 'rgba(255,149,0,0.08)', text: '#ff9500' },
}

const SPEC_EMOJI: Record<string, string> = {
  'Silový trénink': '🏋️',
  'HIIT': '⚡',
  'Výživa': '🥗',
  'Hubnutí': '📉',
  'Rekomposice': '🔄',
  'Online': '🌐',
  'Nabírání': '💪',
}

export default function TrainerProfileScreen() {
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>()
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const [showFullBio, setShowFullBio] = useState(false)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const { t } = useTranslation()
  const { sendRequest, cancelRequest, isSendingRequest } = useCollaboration()
  const pendingRequests = useAuthStore((s) => s.pendingRequests)
  const hasTrainer = useAuthStore((s) => s.hasTrainer)
  const hasCoach = useAuthStore((s) => s.hasCoach)
  const trainer = useAuthStore((s) => s.trainer)
  const coach = useAuthStore((s) => s.coach)

  const query = useQuery({
    queryKey: ['trainer-profile', trainerId],
    queryFn: () => getProfessionalProfile(trainerId!),
    enabled: !!trainerId,
  })

  const profile = query.data
  const isPending = pendingRequests.some((r) => r.trainerId === trainerId)
  const isLinked =
    (trainer?.id === trainerId && hasTrainer) ||
    (coach?.id === trainerId && hasCoach)

  if (query.isLoading || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 100 }} />
      </View>
    )
  }

  const fullName = `${profile.firstName} ${profile.lastName}`
  const roles = profile.roles?.length ? profile.roles : []
  const roleLabel = roles
    .map((r) => (r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výživový poradce' : r))
    .join(' & ')
  const priceLabel = profile.estimatedPrice ?? ''

  const bioSentences = profile.bio?.split('. ') ?? []
  const firstBio = bioSentences.slice(0, 2).join('. ') + (bioSentences.length > 2 ? '.' : '')
  const restBio = bioSentences.slice(2).join('. ')

  const showCTA = !isLinked

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Fixed blurred header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={colors.blue} />
            <Text style={[styles.backLabel, { color: colors.blue }]}>{t('collab.title')}</Text>
          </Pressable>
          {showCTA && !isPending && (
            <Pressable
              onPress={() => setShowInviteSheet(true)}
              style={({ pressed }) => [
                styles.headerCTA,
                { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.headerCTAText}>{t('collab.contact')}</Text>
            </Pressable>
          )}
          {isPending && (
            <Pressable
              onPress={() => Alert.alert(
                t('collab.revokeTitle'),
                t('collab.revokeMessage', { name: fullName }),
                [
                  { text: t('collab.endCollabCancel'), style: 'cancel' },
                  { text: t('collab.revokeConfirm'), style: 'destructive', onPress: () => {
                    const req = pendingRequests.find((r) => r.trainerId === trainerId)
                    if (req) cancelRequest(req.id)
                  }},
                ],
              )}
              style={({ pressed }) => [
                styles.headerCTA,
                { backgroundColor: 'rgba(255,59,48,0.08)', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.headerCTAText, { color: colors.red }]}>{t('collab.cancelRequest')}</Text>
            </Pressable>
          )}
        </View>
        <View style={[styles.headerBorder, { backgroundColor: colors.sep2 }]} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 52, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { borderBottomColor: colors.sep2 }]}>
          <Avatar name={fullName} size="lg" />
          <Text style={[styles.heroName, { color: colors.label }]}>{fullName}</Text>
          <Text style={[styles.heroRole, { color: colors.label2 }]}>{roleLabel}</Text>
          {profile.city && (
            <Text style={[styles.heroCity, { color: colors.label3 }]}>
              📍 {profile.city}
            </Text>
          )}
          {priceLabel.length > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceValue, { color: colors.label }]}>
                {priceLabel} Kč{' '}
              </Text>
              <Text style={[styles.priceUnit, { color: colors.label3 }]}>/ {t('collab.pricePerMonth')}</Text>
            </View>
          )}
          {/* Tags */}
          <View style={styles.heroTags}>
            <View style={[styles.statusTag, { backgroundColor: colors.green + '20' }]}>
              <Text style={[styles.statusTagText, { color: colors.green }]}>
                🟢 {t('collab.acceptingClients')}
              </Text>
            </View>
            {profile.specializations.map((s) => (
              <View key={s} style={[styles.specPill, { backgroundColor: colors.fill }]}>
                <Text style={[styles.specPillText, { color: colors.label2 }]}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* About */}
        {profile.bio && (
          <View style={styles.bioCard}>
            <View style={[styles.bioCardInner, { backgroundColor: colors.bg2 }]}>
              <Text style={[styles.sectionLabel, { color: colors.label3 }]}>{t('collab.aboutMe')}</Text>
              <Text style={[styles.bioText, { color: colors.label2 }]}>{firstBio}</Text>
              {restBio.length > 0 && (
                <>
                  {showFullBio && (
                    <Text style={[styles.bioText, { color: colors.label2, marginTop: 8 }]}>
                      {restBio}
                    </Text>
                  )}
                  <Pressable onPress={() => setShowFullBio(!showFullBio)}>
                    <Text style={[styles.bioToggle, { color: colors.blue }]}>
                      {showFullBio ? t('collab.showLess') : t('collab.showMore')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        )}

        {/* Certificates */}
        {profile.certificates.length > 0 && (
          <View style={styles.bioCard}>
            <View style={[styles.bioCardInner, { backgroundColor: colors.bg2 }]}>
              <Text style={[styles.sectionLabel, { color: colors.label3 }]}>{t('collab.certificates')}</Text>
              {profile.certificates.map((cert, i) => (
                <View key={i} style={styles.certRow}>
                  <View style={[styles.certIcon, { backgroundColor: colors.green + '15' }]}>
                    <Text style={{ fontSize: 16 }}>🎓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.certName, { color: colors.label }]}>{cert}</Text>
                  </View>
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.green + '15' }]}>
                    <Text style={[styles.verifiedText, { color: colors.green }]}>{t('collab.verified')}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Specialisations */}
        {profile.specializations.length > 0 && (
          <View style={styles.bioCard}>
            <View style={[styles.bioCardInner, { backgroundColor: colors.bg2 }]}>
              <Text style={[styles.sectionLabel, { color: colors.label3 }]}>{t('collab.specialisations')}</Text>
              <View style={styles.specGrid}>
                {profile.specializations.map((s) => {
                  const c = SPEC_COLORS[s] ?? { bg: colors.fill, text: colors.label2 }
                  const emoji = SPEC_EMOJI[s] ?? '✨'
                  return (
                    <View key={s} style={[styles.specTag, { backgroundColor: c.bg }]}>
                      <Text style={[styles.specTagText, { color: c.text }]}>
                        {emoji} {s}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {profile && (
        <SendInviteSheet
          visible={showInviteSheet}
          target={{
            id: profile.publicId,
            name: fullName,
            role: roleLabel,
            city: profile.city ?? '',
          }}
          onClose={() => setShowInviteSheet(false)}
          onSend={(id, message) => {
            sendRequest(id, message)
            setShowInviteSheet(false)
          }}
          isSending={isSendingRequest}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Fixed header
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBorder: {
    height: StyleSheet.hairlineWidth,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  backLabel: {
    fontSize: 16,
  },
  headerCTA: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  headerCTAText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 12,
  },
  heroRole: {
    fontSize: 15,
    marginTop: 3,
  },
  heroCity: {
    fontSize: 13,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 10,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceUnit: {
    fontSize: 13,
  },
  heroTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  statusTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  specPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  specPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  bioCard: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bioCardInner: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bioToggle: {
    fontSize: 14,
    marginTop: 8,
  },
  // Certificates
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  certIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certName: {
    fontSize: 14,
    fontWeight: '500',
  },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // Specialisations
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  specTag: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  specTagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Bottom CTAs
  bottomCTA: {
    padding: 20,
    gap: 10,
  },
  ctaButton: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  ctaSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  ctaSecondary: {
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    fontSize: 15,
    fontWeight: '500',
  },
})
