/**
 * Diary request accept wizard.
 *
 * Implements #99: intro card + two mode-selection cards (Bulk / Workflow)
 * with gold-selected state, persistent selection, and Pokračovat CTA.
 *
 * Design-of-record: docs/prototypes/mobile/scenes/diary-accept-wizard.html
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
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/stores/themeStore'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { goldAlpha, greenAlpha } from '@/constants/colors'
import { href } from '@/lib/navigation'
import { Toast } from '@/lib/toast'
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
  const { requestId, professionalName } = useLocalSearchParams<{
    requestId: string
    professionalName: string
  }>()

  // Persisted selection — restores the chosen card on re-entry (AC #3).
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
      // Invalidate today / diary-related queries so banners refresh.
      queryClient.invalidateQueries({ queryKey: ['today-questionnaires'] })
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] })

      // Navigate to the picked flow (AC #2).
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

  const isLoading = acceptMutation.isPending
  const canContinue = selected !== undefined && !isLoading
  const displayName = professionalName ?? ''

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Modal-style top bar ───────────────────────────────── */}
      <View style={[styles.topBar, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.topBarSide, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('diary.acceptWizard.cancel')}
        >
          <Text style={[Type.subheadline, styles.topBarCancel, { color: colors.label2 }]}>
            {t('diary.acceptWizard.cancel')}
          </Text>
        </Pressable>

        <Text
          style={[Type.subheadline, styles.topBarTitle, { color: colors.label }]}
          numberOfLines={1}
        >
          {t('diary.acceptWizard.title')}
        </Text>

        {/* Right spacer — keeps title visually centred. */}
        <View style={styles.topBarSide} />
      </View>

      {/* ── Scrollable content ───────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro card */}
        <View style={[styles.introCard, { backgroundColor: colors.bg2 }]}>
          <Text style={[Type.footnote, styles.introText, { color: colors.label2 }]}>
            {t('diary.acceptWizard.intro', {
              name: displayName || t('common.yourCoach'),
            })}
          </Text>
        </View>

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
          description={t('diary.acceptWizard.workflowDesc')}
          icon="📅"
          colors={colors}
          greenAlphaBg={ga.bg}
          greenAlphaIconBg={ga.iconBg}
          onPress={handleSelect}
        />
      </ScrollView>

      {/* ── Pinned action bar ────────────────────────────────── */}
      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
        ]}
      >
        {/* Pokračovat CTA — disabled until a card is selected (AC #2). */}
        <Pressable
          onPress={() => acceptMutation.mutate()}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.ctaContinue,
            {
              backgroundColor: colors.gold,
              opacity: !canContinue ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.ctaContinueLabel, { color: colors.onAccent }]}>
              {t('diary.acceptWizard.continue')}
            </Text>
          )}
        </Pressable>

        {/* Zrušit / Cancel */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.ctaCancel,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep2,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.ctaCancelLabel, { color: colors.label }]}>
            {t('diary.acceptWizard.cancel')}
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
  /** Scheme-aware green alpha background (for the Workflow card when selected). */
  greenAlphaBg: string
  /** Scheme-aware green alpha icon background (for the Workflow icon box). */
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

  // Card background and border follow prototype:
  // — Bulk selected:    gold tint (goldAlpha['08']) + gold border
  // — Workflow selected: green tint + green border
  // — Unselected:       bg2 + sep2 border
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

  // Icon box: green-tinted for Workflow, gold-tinted for Bulk.
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  topBarSide: {
    width: 64,
  },
  topBarCancel: {
    fontWeight: '600',
  },
  topBarTitle: {
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  introCard: {
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  introText: {
    lineHeight: 20,
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
    fontSize: 20,
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
  actionBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    flexDirection: 'row',
    gap: 10,
  },
  ctaContinue: {
    flex: 1,
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaContinueLabel: {
    ...Type.subheadline,
    fontWeight: '600',
  },
  ctaCancel: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ctaCancelLabel: {
    ...Type.footnote,
    fontWeight: '600',
  },
})

export default DiaryAcceptWizardScreen
