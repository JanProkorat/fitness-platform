import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { href } from '@/lib/navigation'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { useAuthStore } from '@/stores/auth'
import { useCollaboration } from '@/hooks/useCollaboration'

const INCLUDES = [
  { emoji: '🏋️', i18nKey: 'collab.includeTraining', bg: 'rgba(11,110,153,0.1)' },
  { emoji: '🥗', i18nKey: 'collab.includeNutrition', bg: 'rgba(52,199,89,0.1)' },
  { emoji: '💬', i18nKey: 'collab.includeMessaging', bg: 'rgba(0,122,255,0.1)' },
  { emoji: '📈', i18nKey: 'collab.includeProgress', bg: 'rgba(201,168,76,0.1)' },
]

export default function InviteDetailScreen() {
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const invite = useAuthStore((s) => s.pendingInvite)
  const { acceptInvite, declineInvite } = useCollaboration()

  if (!invite) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 100 }} />
      </View>
    )
  }

  const handleAccept = () => {
    acceptInvite(invite.id)
    router.replace('/(client)')
  }

  const handleDecline = () => {
    declineInvite(invite.id)
    router.back()
  }

  const sentDate = new Date(invite.sentAt)
  const sentLabel = `${sentDate.getHours()}:${sentDate.getMinutes().toString().padStart(2, '0')}`

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Fixed header */}
      <View style={[styles.fixedHeader, { paddingTop: insets.top }]}>
        <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
            <Text style={[styles.backLabel, { color: colors.gold }]}>{t('tabs.today')}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.label }]}>{t('collab.invitation')}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.headerBorder, { backgroundColor: colors.sep2 }]} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 52, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Trainer mini-profile */}
        <View style={[styles.profile, { borderBottomColor: colors.sep2 }]}>
          <Avatar name={invite.trainerName} size="lg" />
          <Text style={[styles.profileName, { color: colors.label }]}>{invite.trainerName}</Text>
          <Text style={[styles.profileRole, { color: colors.label2 }]}>{invite.trainerRole}</Text>
          {invite.trainerCity && (
            <Text style={[styles.profileCity, { color: colors.label3 }]}>
              📍 {invite.trainerCity}
            </Text>
          )}
          <Pressable
            onPress={() =>
              router.push(href(`/(client)/discover/${invite.trainerId}`))
            }
          >
            <Text style={[styles.viewProfile, { color: colors.blue }]}>
              {t('collab.viewFullProfile')}
            </Text>
          </Pressable>
        </View>

        {/* Trainer message */}
        {invite.message && (
          <View style={[styles.section, { borderBottomColor: colors.sep2 }]}>
            <Text style={[styles.sectionLabel, { color: colors.label3 }]}>
              {t('collab.trainerMessage')}
            </Text>
            <View style={styles.messageRow}>
              <Avatar name={invite.trainerName} size="sm" />
              <View style={[styles.bubble, { backgroundColor: colors.bg2 }]}>
                <Text style={[styles.bubbleText, { color: colors.label }]}>
                  {invite.message}
                </Text>
                <Text style={[styles.bubbleTime, { color: colors.label3 }]}>
                  {sentLabel}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* What's included */}
        <View style={[styles.section, { borderBottomColor: colors.sep2 }]}>
          <Text style={[styles.sectionLabel, { color: colors.label3 }]}>
            {t('collab.includesTitle')}
          </Text>
          {INCLUDES.map((item) => (
            <View key={item.i18nKey} style={styles.includeRow}>
              <View style={[styles.includeIcon, { backgroundColor: item.bg }]}>
                <Text style={{ fontSize: 15 }}>{item.emoji}</Text>
              </View>
              <Text style={[styles.includeText, { color: colors.label }]}>{t(item.i18nKey)}</Text>
            </View>
          ))}
        </View>

        {/* Price */}
        {invite.price > 0 && (
          <View style={[styles.priceRow, { borderBottomColor: colors.sep2 }]}>
            <Text style={[styles.priceLabel, { color: colors.label2 }]}>
              {t('collab.monthlySubscription')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={[styles.priceValue, { color: colors.label }]}>
                {invite.price.toLocaleString('cs-CZ')} Kč{' '}
              </Text>
              <Text style={[styles.priceUnit, { color: colors.label3 }]}>
                / {invite.pricePeriod || 'měsíc'}
              </Text>
            </View>
          </View>
        )}

        {/* CTAs */}
        <View style={styles.ctas}>
          <Pressable
            onPress={handleAccept}
            style={({ pressed }) => [
              styles.acceptBtn,
              { backgroundColor: colors.gold, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.acceptText}>{t('collab.acceptInvitation')}</Text>
          </Pressable>
          <Pressable
            onPress={handleDecline}
            style={({ pressed }) => [
              styles.declineBtn,
              { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.declineText, { color: colors.label2 }]}>{t('collab.decline')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Header
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
  headerBorder: { height: StyleSheet.hairlineWidth },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backLabel: { fontSize: 16 },
  headerTitle: { ...Type.headline, textAlign: 'center' },
  // Profile
  profile: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 12,
  },
  profileRole: { fontSize: 14, marginTop: 3 },
  profileCity: { fontSize: 13, marginTop: 2 },
  viewProfile: { fontSize: 14, marginTop: 12 },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  // Message
  messageRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bubble: {
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 14,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  bubbleTime: { fontSize: 11, marginTop: 6 },
  // Includes
  includeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  includeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  includeText: { fontSize: 14 },
  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 18, fontWeight: '700' },
  priceUnit: { fontSize: 13 },
  // CTAs
  ctas: { padding: 20, gap: 10 },
  acceptBtn: { paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  acceptText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  declineBtn: { paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
  declineText: { fontSize: 15, fontWeight: '500' },
})
