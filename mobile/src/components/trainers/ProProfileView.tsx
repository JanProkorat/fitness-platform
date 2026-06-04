/**
 * ProProfileView — inline full profile for an active collaborator.
 *
 * Used on the Spolupráce screen (Trenér / Poradce tabs). Fetches the public
 * profile via TanStack Query, sharing the ['trainer-profile', id] cache with
 * the standalone [trainerId].tsx detail screen.
 *
 * All colors route through useTheme() — no hardcoded hex values.
 * The SPEC_COLORS map from [trainerId].tsx is replaced with a token-backed
 * lookup using theme system color slots.
 */
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
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Avatar } from '@/components/ui/Avatar'
import { getProfessionalProfile } from '@/api/professionals'
import type { ColorScheme } from '@/constants/colors'

// ─── Token-backed spec colour lookup ─────────────────────────────────
// Replaces the SPEC_COLORS hex map in [trainerId].tsx.
// Uses system color slots from the theme so dark-mode works correctly.

type SpecStyle = { bg: string; text: string }

function getSpecStyle(spec: string, colors: ColorScheme): SpecStyle {
  switch (spec) {
    case 'Silový trénink': return { bg: colors.blue + '14', text: colors.blue }
    case 'HIIT':           return { bg: colors.orange + '14', text: colors.orange }
    case 'Výživa':         return { bg: colors.green + '14', text: colors.green }
    case 'Hubnutí':        return { bg: colors.purple + '14', text: colors.purple }
    case 'Rekomposice':    return { bg: colors.blue + '14', text: colors.blue }
    case 'Online':         return { bg: colors.fill, text: colors.label2 }
    case 'Nabírání':       return { bg: colors.orange + '14', text: colors.orange }
    default:               return { bg: colors.fill, text: colors.label2 }
  }
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

// ─── Props ────────────────────────────────────────────────────────────

interface ProProfileViewProps {
  /** Public ID of the professional — used as the query key and API param. */
  professionalPublicId: string
  /** Display name used in the end-collab alert. */
  displayName: string
  /** ISO date string when the collaboration started (from auth store).
   *  Pass empty string to suppress the active-since badge. */
  activeSince: string
  onMessagePress: () => void
  onEndCollabPress: () => void
  /** When false, hides the Zpráva/Ukončit action bar.
   *  Defaults to true — the bar is shown for active collaborators.
   *  Pass false for non-linked profiles viewed from the discovery detail screen. */
  showActionBar?: boolean
}

// ─── Component ────────────────────────────────────────────────────────

export function ProProfileView({
  professionalPublicId,
  displayName,
  activeSince,
  onMessagePress,
  onEndCollabPress,
  showActionBar = true,
}: ProProfileViewProps) {
  const colors = useTheme()
  const { t, i18n } = useTranslation()
  const [showFullBio, setShowFullBio] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['trainer-profile', professionalPublicId],
    queryFn: () => getProfessionalProfile(professionalPublicId),
    enabled: Boolean(professionalPublicId),
  })

  const styles = makeStyles(colors)

  // ── Loading ──────────────────────────────────────────────────────────
  if (profileQuery.isPending) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('collab.profileLoadError')}</Text>
        <Pressable onPress={() => profileQuery.refetch()} style={styles.retryBtn}>
          <Text style={styles.retryText}>{t('collab.retry')}</Text>
        </Pressable>
      </View>
    )
  }

  const profile = profileQuery.data
  const fullName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
  const roles = profile.roles?.length ? profile.roles : []
  const roleLabel = roles
    .map((r) => (r === 'Trainer' ? 'Osobní trenér' : r === 'Nutritionist' ? 'Výživový poradce' : r))
    .join(' & ')

  // Format the since date using the active locale (mirrors DateSeparator.tsx pattern)
  const sinceDate = activeSince
    ? new Date(activeSince).toLocaleDateString(i18n.language, { day: 'numeric', month: 'numeric', year: 'numeric' })
    : ''

  // Bio handling
  const bioSentences = profile.bio?.split('. ') ?? []
  const firstBio = bioSentences.slice(0, 2).join('. ') + (bioSentences.length > 2 ? '.' : '')
  const restBio = bioSentences.slice(2).join('. ')

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Avatar
          name={fullName}
          size="lg"
          imageUrl={profile.avatarBlobUrl}
        />
        <Text style={styles.heroName}>{fullName}</Text>
        <Text style={styles.heroRole}>{roleLabel}</Text>
        {profile.city && (
          <Text style={styles.heroCity}>📍 {profile.city}</Text>
        )}

        {/* Active-since badge — date from auth store, not from profile API.
            Suppressed when activeSince is empty (e.g. unlinked/pending pros
            viewed from the discovery detail screen). */}
        {activeSince ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>
              🟢 {t('collab.activeSince', { date: sinceDate })}
            </Text>
          </View>
        ) : null}

        {/* Spec pills */}
        <View style={styles.heroTags}>
          {(profile.specializations ?? []).map((s) => (
            <View key={s} style={[styles.specPill, { backgroundColor: colors.fill }]}>
              <Text style={[styles.specPillText, { color: colors.label2 }]}>{s}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Bio ───────────────────────────────────────────────────── */}
      {profile.bio && (
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={styles.sectionLabel}>{t('collab.aboutMe')}</Text>
            <Text style={styles.bioText}>{firstBio}</Text>
            {restBio.length > 0 && (
              <>
                {showFullBio && (
                  <Text style={[styles.bioText, styles.bioTextExtra]}>{restBio}</Text>
                )}
                <Pressable onPress={() => setShowFullBio(!showFullBio)}>
                  <Text style={styles.bioToggle}>
                    {showFullBio ? t('collab.showLess') : t('collab.showMore')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* ── Certificates ──────────────────────────────────────────── */}
      {(profile.certificates?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={styles.sectionLabel}>{t('collab.certificates')}</Text>
            {(profile.certificates ?? []).map((cert, i) => (
              <View key={i} style={styles.certRow}>
                <View style={[styles.certIcon, { backgroundColor: colors.green + '26' }]}>
                  <Text style={styles.certEmoji}>🎓</Text>
                </View>
                <Text style={styles.certName}>{cert}</Text>
                <View style={[styles.verifiedBadge, { backgroundColor: colors.green + '26' }]}>
                  <Text style={[styles.verifiedText, { color: colors.green }]}>
                    {t('collab.verified')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Specialisations ───────────────────────────────────────── */}
      {(profile.specializations?.length ?? 0) > 0 && (
        <View style={styles.card}>
          <View style={styles.cardInner}>
            <Text style={styles.sectionLabel}>{t('collab.specialisations')}</Text>
            <View style={styles.specGrid}>
              {(profile.specializations ?? []).map((s) => {
                const specStyle = getSpecStyle(s, colors)
                const emoji = SPEC_EMOJI[s] ?? '✨'
                return (
                  <View key={s} style={[styles.specTag, { backgroundColor: specStyle.bg }]}>
                    <Text style={[styles.specTagText, { color: specStyle.text }]}>
                      {emoji} {s}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}

      {/* ── Bottom action bar ──────────────────────────────────────── */}
      {showActionBar && (
        <View style={styles.actionBar}>
          <Pressable
            onPress={onMessagePress}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnMessage, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.label }]}>
              {t('collab.message')}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert(
                t('collab.endCollabTitle'),
                t('collab.endCollabMessage', { name: displayName }),
                [
                  { text: t('collab.endCollabCancel'), style: 'cancel' },
                  { text: t('collab.endCollabConfirm'), style: 'destructive', onPress: onEndCollabPress },
                ],
              )
            }}
            style={({ pressed }) => [styles.actionBtn, styles.actionBtnEnd, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.red }]}>
              {t('collab.endCollab')}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────

const makeStyles = (colors: ColorScheme) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingTop: 80,
      gap: 12,
    },
    errorText: {
      ...Type.subheadline,
      color: colors.label2,
      textAlign: 'center',
    },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: Radius.full,
      backgroundColor: colors.fill,
    },
    retryText: {
      ...Type.subheadline,
      fontWeight: '600',
      color: colors.label,
    },
    // Hero
    hero: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.sep2,
    },
    heroName: {
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.3,
      marginTop: 12,
      color: colors.label,
    },
    heroRole: {
      fontSize: 15,
      marginTop: 3,
      color: colors.label2,
    },
    heroCity: {
      fontSize: 13,
      marginTop: 2,
      color: colors.label3,
    },
    activeBadge: {
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 5,
      borderRadius: Radius.full,
      backgroundColor: colors.green + '1F', // ~12% alpha
    },
    activeBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.green,
    },
    heroTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      marginTop: 10,
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
    // Cards
    card: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    cardInner: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: colors.bg2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      color: colors.label3,
    },
    bioText: {
      fontSize: 15,
      lineHeight: 24,
      color: colors.label2,
    },
    bioTextExtra: {
      marginTop: 8,
    },
    bioToggle: {
      fontSize: 14,
      marginTop: 8,
      color: colors.blue,
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
    certEmoji: {
      fontSize: 16,
    },
    certName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.label,
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
    // Action bar
    actionBar: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 20,
    },
    actionBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: 'center',
    },
    actionBtnMessage: {
      backgroundColor: colors.fill,
    },
    actionBtnEnd: {
      backgroundColor: colors.red + '1A', // ~10% alpha
    },
    actionBtnText: {
      fontSize: 15,
      fontWeight: '600',
    },
    bottomSpacer: {
      height: 20,
    },
  })

export default ProProfileView
