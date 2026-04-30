/**
 * Diary request management screen.
 *
 * Single entry point reached from the Today banner's "Manage" button.
 * Header: classic back button + "Photo diary" title.
 * Body: intro hero (camera emoji + title + description + coach card)
 *       above two mode-selection cards (Bulk / Workflow).
 * Footer: stacked Accept (primary) above Revoke (secondary).
 *
 * Accept = persist mode + accept on the server + navigate to the picked flow
 * (bulk or workflow) in one tap.
 * Revoke = navigate to the dismiss screen where the client can optionally
 * type a reason before confirming. The actual API call lives there.
 *
 * Design-of-record: the questionnaire IntroScreen sets the visual hierarchy
 * (clipboard hero + coach card with avatar + role/city).
 */
import React, { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/stores/themeStore'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { Colors, goldAlpha, greenAlpha } from '@/constants/colors'
import { href } from '@/lib/navigation'
import { Toast } from '@/lib/toast'
import { Avatar } from '@/components/ui/Avatar'
import { useDiaryStore, type DiaryMode } from '@/stores/diaryStore'
import { acceptDiaryRequest, PhotoDiaryMode } from '@/api/diaryRequests'

// ─── Main screen ──────────────────────────────────────────────────────

export function DiaryAcceptWizardScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()

  // Dark-mode-aware green alpha values (same pattern as DiaryRequestBanner).
  const systemScheme = useColorScheme()
  const preference = useThemeStore((s) => s.preference)
  const effectiveScheme = preference === 'system' ? (systemScheme ?? 'light') : preference
  const ga = effectiveScheme === 'dark' ? greenAlpha.dark : greenAlpha.light

  // useLocalSearchParams requires all values to be string (Expo Router constraint).
  // `durationDays` is forwarded by the Today screen as a string and parsed
  // back to a number here so the wizard copy can render the trainer's chosen
  // diary length (3 / 7 / 14 / …) instead of a hardcoded "7 days".
  const {
    requestId,
    professionalName,
    professionalRole,
    durationDays: durationDaysParam,
  } = useLocalSearchParams<{
    requestId: string
    professionalName: string
    professionalRole: string
    durationDays?: string
  }>()
  const durationDays = (() => {
    const n = Number(durationDaysParam)
    return Number.isFinite(n) && n > 0 ? n : 7
  })()

  // Persisted selection — restores the chosen card on re-entry.
  const { getSelection, setSelection, clearSelection } = useDiaryStore()
  const [selected, setSelected] = useState<DiaryMode | undefined>(
    () => getSelection(requestId),
  )

  const handleSelect = useCallback(
    (mode: DiaryMode) => {
      setSelected(mode)
      setSelection(requestId, mode)
    },
    [requestId, setSelection],
  )

  const acceptMutation = useMutation({
    mutationFn: () =>
      acceptDiaryRequest(
        requestId,
        selected === 'Bulk' ? PhotoDiaryMode.Bulk : PhotoDiaryMode.Workflow,
      ),
    onSuccess: () => {
      // Clear the persisted selection — the request is now accepted server-side.
      clearSelection(requestId)
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] })
      queryClient.invalidateQueries({ queryKey: ['active-diary-requests'] })

      // Navigate to the picked flow.
      if (selected === 'Bulk') {
        router.replace(href(`/(client)/diary/${requestId}/bulk`))
      } else {
        router.replace(href(`/(client)/diary/${requestId}/workflow`))
      }
    },
    onError: () => {
      Toast.show(t('diary.acceptWizard.errorAccept'))
    },
  })

  const handleRevoke = useCallback(() => {
    router.push(href(`/(client)/diary/${requestId}/dismiss`))
  }, [requestId, router])

  const isAcceptLoading = acceptMutation.isPending
  const canAccept = selected !== undefined && !isAcceptLoading
  const displayName = professionalName ?? t('common.yourCoach')
  const roleLabel =
    professionalRole === 'Trainer'
      ? t('today.diaryBanner.roleTrainer')
      : professionalRole === 'Nutritionist'
      ? t('today.diaryBanner.roleNutritionist')
      : ''

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Header: back button + title ──────────────────────────── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.gold} />
          <Text style={[Type.body, styles.backLabel, { color: colors.gold }]}>
            {t('common.back')}
          </Text>
        </Pressable>

        <Text
          style={[Type.headline, styles.headerTitle, { color: colors.label }]}
          numberOfLines={1}
        >
          {t('diary.acceptWizard.headerTitle')}
        </Text>

        {/* Right spacer to keep title centered. */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Scrollable content ───────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — emoji + title + description + coach card */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>📸</Text>
          <Text style={[styles.heroTitle, { color: colors.label }]}>
            {t('diary.acceptWizard.heroTitle')}
          </Text>
          <Text style={[styles.heroDesc, { color: colors.label2 }]}>
            {t('diary.acceptWizard.heroDesc', { count: durationDays })}
          </Text>

          {/* Coach card */}
          <View style={[styles.coachCard, { backgroundColor: colors.bg2 }]}>
            <Avatar name={displayName} size="sm" />
            <View style={styles.coachText}>
              <Text style={[Type.headline, { color: colors.label, fontSize: 15 }]}>
                {displayName}
              </Text>
              {roleLabel ? (
                <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}>
                  {roleLabel}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.coachChip, { color: colors.label3 }]}>
              {t('diary.acceptWizard.coachChip')}
            </Text>
          </View>
        </View>

        {/* Mode-picker prompt */}
        <Text style={[Type.caption1, styles.modePrompt, { color: colors.label3 }]}>
          {t('diary.acceptWizard.modePrompt')}
        </Text>

        {/* Mode card — Bulk (gold accent when selected) */}
        <ModeCard
          mode="Bulk"
          selected={selected === 'Bulk'}
          title={t('diary.acceptWizard.bulkTitle')}
          description={t('diary.acceptWizard.bulkDesc')}
          icon="📤"
          colors={colors}
          greenAlphaBg={ga.bg}
          greenAlphaIconBg={ga.iconBg}
          onPress={handleSelect}
        />

        {/* Mode card — Workflow (green accent when selected) */}
        <ModeCard
          mode="Workflow"
          selected={selected === 'Workflow'}
          title={t('diary.acceptWizard.workflowTitle')}
          description={t('diary.acceptWizard.workflowDesc', { count: durationDays })}
          icon="📅"
          colors={colors}
          greenAlphaBg={ga.bg}
          greenAlphaIconBg={ga.iconBg}
          onPress={handleSelect}
        />
      </ScrollView>

      {/* ── Pinned action bar — Accept on top, Revoke below ─────── */}
      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
        ]}
      >
        <Pressable
          onPress={() => acceptMutation.mutate()}
          disabled={!canAccept}
          style={({ pressed }) => [
            styles.ctaPrimary,
            {
              backgroundColor: colors.gold,
              opacity: !canAccept ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAccept }}
        >
          {isAcceptLoading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.ctaPrimaryLabel, { color: colors.onAccent }]}>
              {t('diary.acceptWizard.accept')}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleRevoke}
          disabled={isAcceptLoading}
          style={({ pressed }) => [
            styles.ctaSecondary,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep2,
              opacity: isAcceptLoading ? 0.45 : pressed ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: isAcceptLoading }}
        >
          <Text style={[styles.ctaSecondaryLabel, { color: colors.label }]}>
            {t('diary.acceptWizard.revoke')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── Mode card ────────────────────────────────────────────────────────

interface ModeCardProps {
  mode: DiaryMode
  selected: boolean
  title: string
  description: string
  icon: string
  colors: ReturnType<typeof useTheme>
  greenAlphaBg: string
  greenAlphaIconBg: string
  onPress: (mode: DiaryMode) => void
}

function ModeCard({
  mode,
  selected,
  title,
  description,
  icon,
  colors,
  greenAlphaBg,
  greenAlphaIconBg,
  onPress,
}: ModeCardProps) {
  const isWorkflow = mode === 'Workflow'

  const cardBg = selected
    ? isWorkflow
      ? greenAlphaBg
      : goldAlpha['08']
    : colors.bg2

  const cardBorderColor = selected
    ? isWorkflow
      ? colors.green
      : colors.gold
    : colors.sep2

  const cardBorderWidth = selected ? 1.5 : 1

  const iconBg = isWorkflow ? greenAlphaIconBg : goldAlpha['15']

  return (
    <Pressable
      onPress={() => onPress(mode)}
      style={({ pressed }) => [
        styles.modeCard,
        {
          backgroundColor: cardBg,
          borderColor: cardBorderColor,
          borderWidth: cardBorderWidth,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={[styles.modeIconBox, { backgroundColor: iconBg }]}>
        <Text style={styles.modeIcon}>{icon}</Text>
      </View>
      <View style={styles.modeText}>
        <Text style={[Type.callout, styles.modeTitle, { color: colors.label }]}>
          {title}
        </Text>
        <Text style={[Type.footnote, styles.modeDesc, { color: colors.label2 }]}>
          {description}
        </Text>
      </View>
    </Pressable>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────

const HEADER_SIDE_WIDTH = 92
const HERO_EMOJI_SIZE = 56
const HERO_TITLE_SIZE = 26
const HERO_DESC_SIZE = 15
const COACH_CHIP_SIZE = 13

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: HEADER_SIDE_WIDTH,
    paddingVertical: 6,
  },
  backLabel: {
    fontWeight: '600',
    marginLeft: -2,
  },
  headerTitle: {
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: HEADER_SIDE_WIDTH,
  },

  // Scrollable body
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 14,
  },
  heroEmoji: {
    fontSize: HERO_EMOJI_SIZE,
    lineHeight: HERO_EMOJI_SIZE + 4,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: HERO_TITLE_SIZE,
    fontWeight: '700',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: HERO_DESC_SIZE,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
    width: '100%',
    shadowColor: Colors.dark.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  coachText: {
    flex: 1,
    minWidth: 0,
  },
  coachChip: {
    fontSize: COACH_CHIP_SIZE,
    fontWeight: '500',
  },

  // Mode prompt + cards
  modePrompt: {
    marginBottom: 12,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  modeCard: {
    borderRadius: Radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  modeIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modeIcon: {
    fontSize: Type.title3.fontSize,
  },
  modeText: {
    flex: 1,
    minWidth: 0,
  },
  modeTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  modeDesc: {
    lineHeight: 18,
  },

  // Action bar — stacked
  actionBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 0.5,
    gap: 10,
  },
  ctaPrimary: {
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimaryLabel: {
    ...Type.subheadline,
    fontWeight: '600',
  },
  ctaSecondary: {
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ctaSecondaryLabel: {
    ...Type.subheadline,
    fontWeight: '500',
  },
})

export default DiaryAcceptWizardScreen
