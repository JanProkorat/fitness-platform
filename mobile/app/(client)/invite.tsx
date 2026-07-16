import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Static, goldAlpha } from '@/constants/colors'
import type { ColorScheme } from '@/constants/colors'
import { Avatar } from '@/components/ui/Avatar'
import { ProProfileView } from '@/components/trainers/ProProfileView'
import { useClientInvite } from '@/hooks/useClientInvite'
import { Toast } from '@/lib/toast'

// ─── "What's included" list — icon backgrounds route through theme tokens
// (colors.* + alpha suffix / goldAlpha), never raw hex/rgba literals. ──────

function getIncludes(colors: ColorScheme) {
  return [
    { emoji: '🏋️', i18nKey: 'collab.includeTraining', bg: colors.blue + '1A' },
    { emoji: '🥗', i18nKey: 'collab.includeNutrition', bg: colors.green + '1A' },
    { emoji: '💬', i18nKey: 'collab.includeMessaging', bg: colors.purple + '1A' },
    { emoji: '📈', i18nKey: 'collab.includeProgress', bg: goldAlpha['10'] },
  ]
}

// #816 — this screen is promoted OUT of the discover tab's stack onto the
// (client) parent stack (mirrors coach-profile/[coachId]) so opening it from
// Today no longer pollutes the Spolupráce tab's own navigation history.
//
// #815 — the `origin` param (set by each push site) drives the back-button
// label: 'collab' -> tabs.collab ("Spolupráce"), anything else -> tabs.today
// ("Dnes"), matching wherever the user actually came from.
export default function InviteDetailScreen() {
  const router = useRouter()
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { origin } = useLocalSearchParams<{ origin?: string }>()
  const { invite, isLoading, accept, decline } = useClientInvite(true)

  const backLabel = origin === 'collab' ? t('tabs.collab') : t('tabs.today')

  const handleAccept = () => {
    if (!invite) return
    accept(invite.id, {
      onSuccess: () => router.replace('/(client)'),
      onError: () => Toast.show(t('collab.actionFailed')),
    })
  }

  const handleDecline = () => {
    if (!invite) return
    decline(invite.id, {
      onSuccess: () => router.back(),
      onError: () => Toast.show(t('collab.actionFailed')),
    })
  }

  const styles = makeStyles(colors)

  // Loading — first fetch of GET /client/invites/pending in flight.
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.gold} style={styles.loadingSpinner} />
      </View>
    )
  }

  // Empty state — 204/no-pending-invite (already resolved elsewhere, or a
  // stale nav into this screen). Never spin forever; give the user a way out
  // back to whichever tab they came from.
  if (!invite) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.fixedHeader, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.gold} />
              <Text style={[styles.backLabel, { color: colors.gold }]}>{backLabel}</Text>
            </Pressable>
          </View>
          <View style={[styles.headerBorder, { backgroundColor: colors.sep2 }]} />
        </View>
        <View style={[styles.emptyState, { paddingTop: insets.top + 52 }]}>
          <Ionicons name="mail-open-outline" size={40} color={colors.label3} />
          <Text style={[Type.headline, styles.emptyTitle, { color: colors.label }]}>
            {t('collab.noInviteTitle')}
          </Text>
          <Text style={[Type.subheadline, styles.emptyHint, { color: colors.label3 }]}>
            {t('collab.noInviteHint')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.emptyBackBtn,
              { backgroundColor: colors.fill, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.emptyBackText, { color: colors.label }]}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Fixed header — flat page background, no blur band (#813).
          Avatar/name/role now live in ProProfileView's hero below instead
          of a separately-boxed profile section. */}
      <View style={[styles.fixedHeader, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
            <Text style={[styles.backLabel, { color: colors.gold }]}>{backLabel}</Text>
          </Pressable>
        </View>
        <View style={[styles.headerBorder, { backgroundColor: colors.sep2 }]} />
      </View>

      <View style={[styles.body, { paddingTop: insets.top + 52 }]}>
        <ProProfileView
          professionalPublicId={invite.trainerId}
          displayName={invite.trainerName}
          activeSince=""
          onMessagePress={() => {}}
          onEndCollabPress={() => {}}
          showActionBar={false}
          footer={
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
          }
        >
          {/* Trainer message — live TrainerInvite has no sentAt, so the
              bubble renders without a timestamp instead of parsing an
              undefined date. */}
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
                </View>
              </View>
            </View>
          )}

          {/* What's included */}
          <View style={[styles.section, { borderBottomColor: colors.sep2 }]}>
            <Text style={[styles.sectionLabel, { color: colors.label3 }]}>
              {t('collab.includesTitle')}
            </Text>
            {getIncludes(colors).map((item) => (
              <View key={item.i18nKey} style={styles.includeRow}>
                <View style={[styles.includeIcon, { backgroundColor: item.bg }]}>
                  <Text style={styles.includeEmoji}>{item.emoji}</Text>
                </View>
                <Text style={[styles.includeText, { color: colors.label }]}>{t(item.i18nKey)}</Text>
              </View>
            ))}
          </View>
        </ProProfileView>
      </View>
    </View>
  )
}

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    body: { flex: 1 },
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
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    headerBorder: { height: StyleSheet.hairlineWidth },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    backLabel: { fontSize: 16 },
    // Sections (rendered as ProProfileView children)
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
      borderRadius: Radius.lg,
      borderBottomLeftRadius: 4,
      padding: 14,
      maxWidth: 280,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    bubbleText: { fontSize: 15, lineHeight: 22 },
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
      borderRadius: Radius.iconBox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    includeEmoji: { fontSize: 15 },
    includeText: { fontSize: 14 },
    // CTAs (rendered as ProProfileView footer)
    ctas: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 10 },
    acceptBtn: { paddingVertical: 15, borderRadius: Radius.lg, alignItems: 'center' },
    acceptText: { fontSize: 17, fontWeight: '600', color: Static.alwaysWhite },
    declineBtn: { paddingVertical: 13, borderRadius: Radius.lg, alignItems: 'center' },
    declineText: { fontSize: 15, fontWeight: '500' },
    // Loading
    loadingSpinner: { marginTop: 100 },
    // Empty state
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyTitle: { marginTop: 12, textAlign: 'center' },
    emptyHint: { marginTop: 4, textAlign: 'center' },
    emptyBackBtn: {
      marginTop: 20,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: Radius.lg,
    },
    emptyBackText: { fontSize: 15, fontWeight: '600' },
  })
