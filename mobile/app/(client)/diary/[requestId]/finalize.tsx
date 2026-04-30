/**
 * Diary Finalize Screen — confirmation + submit on day N.
 *
 * Per prototype diary-finalize.html:
 *   1. Modal-style header: "Day N · finish" + close button.
 *   2. Hero block: ✅ icon, title, sub-text with photo/day counts.
 *   3. Summary stats grid: total photos / days completed / attendance %.
 *   4. "Add last photo" section — dashed placeholder CTA.
 *   5. Pinned action bar: "Submit to coach" (gold) + "Add another photo".
 *
 * Route params: requestId (from [requestId] segment).
 *
 * Tapping "Submit to coach" → submitDiaryRequest() → toast → navigate back to Today.
 * Tapping "Add another photo" → go back to the workflow screen.
 */

import React, { useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useImagePicker } from '@/hooks/useImagePicker'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import {
  getDiaryRequestById,
  submitDiaryRequest,
  type ClientPhotoDiaryRequestSummary,
} from '@/api/diaryRequests'
import {
  getPlanPhotos,
  generatePlanPhotoUploadUrl,
  finalizePlanPhoto,
  PlanPhotoCategory,
  type PlanPhotoResponse,
} from '@/api/planPhotos'
import { Toast } from '@/lib/toast'
import { href } from '@/lib/navigation'

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeCurrentDay(
  acceptedAt: string | undefined,
  durationDays: number,
): number {
  if (!acceptedAt) return durationDays
  const msPerDay = 24 * 60 * 60 * 1000
  const daysSince = Math.floor((Date.now() - new Date(acceptedAt).getTime()) / msPerDay)
  return Math.min(daysSince + 1, durationDays)
}

/** Count how many distinct days had at least one photo. */
function countDaysWithPhotos(
  photos: PlanPhotoResponse[],
  acceptedAt: string,
): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const acceptedMidnight = new Date(
    new Date(acceptedAt).getFullYear(),
    new Date(acceptedAt).getMonth(),
    new Date(acceptedAt).getDate(),
  ).getTime()
  const daySet = new Set(
    photos
      .filter((p) => !!p.dateCreated)
      .map((p) =>
        Math.max(
          0,
          Math.floor((new Date(p.dateCreated!).getTime() - acceptedMidnight) / msPerDay),
        ),
      ),
  )
  return daySet.size
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function DiaryFinalizeScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  // ── Query: diary request metadata ──
  const requestQuery = useQuery<ClientPhotoDiaryRequestSummary | undefined>({
    queryKey: ['diary-request', requestId],
    queryFn: () => getDiaryRequestById(requestId ?? ''),
    enabled: !!requestId,
    staleTime: 60_000,
  })
  const request = requestQuery.data

  const durationDays = request?.durationDays ?? 7
  const currentDay = computeCurrentDay(request?.acceptedAt, durationDays)

  // ── Query: photos for this diary request ──
  // Backend validator caps `pageSize` at 100 (InclusiveBetween(1, 100)) — the
  // earlier 200 on this query 400'd silently and the finalize summary always
  // rendered an empty list. 100 is plenty: a 14-day diary at 5 photos/day
  // tops out at ~70 entries, well under the cap.
  const planId = request?.planId
  const photosQuery = useQuery<PlanPhotoResponse[]>({
    queryKey: ['plan-photos', planId],
    queryFn: () => getPlanPhotos(planId ?? '', 1, 100),
    enabled: !!planId,
    staleTime: 30_000,
  })

  const diaryPhotos = useMemo(
    () => (photosQuery.data ?? []).filter((p) => p.diaryRequestId === requestId),
    [photosQuery.data, requestId],
  )

  const daysWithPhotos = useMemo(
    () =>
      request?.acceptedAt
        ? countDaysWithPhotos(diaryPhotos, request.acceptedAt)
        : 0,
    [diaryPhotos, request?.acceptedAt],
  )

  const attendancePct =
    durationDays > 0 ? Math.round((daysWithPhotos / durationDays) * 100) : 0

  // ── Submit mutation ──
  const submitMutation = useMutation({
    mutationFn: () => submitDiaryRequest(requestId ?? ''),
    onSuccess: () => {
      Toast.show(t('diary.finalize.successToast'))
      queryClient.invalidateQueries({ queryKey: ['active-diary-requests'] })
      queryClient.invalidateQueries({ queryKey: ['diary-request', requestId] })
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      // Navigate to Today tab
      router.replace(href('/(client)/(tabs)'))
    },
    onError: () => {
      Toast.show(t('diary.finalize.errorSubmit'))
    },
  })

  // ── Last-photo upload ──
  const finalizeMutation = useMutation({
    mutationFn: async (blobUrl: string) => {
      if (!planId) throw new Error('No planId')
      return finalizePlanPhoto(planId, {
        blobUrl,
        category: PlanPhotoCategory.FreeForm,
        diaryRequestId: requestId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-photos', planId] })
    },
    onError: () => {
      Toast.show(t('diary.bulk.errorUpload'))
    },
  })

  const { pick, uploading } = useImagePicker(
    {
      source: 'both',
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        if (!planId) throw new Error('No planId')
        return generatePlanPhotoUploadUrl(planId, contentType, sizeBytes)
      },
    },
    (blobUrl) => {
      finalizeMutation.mutate(blobUrl)
    },
  )

  const isUploading = uploading || finalizeMutation.isPending
  const isSubmitting = submitMutation.isPending

  const handleSubmit = useCallback(() => {
    submitMutation.mutate()
  }, [submitMutation])

  const handleAddMore = useCallback(() => {
    router.back()
  }, [router])

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Modal header ── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          style={styles.headerSideBtn}
        >
          <Text style={[Type.subheadline, { color: colors.label2, fontWeight: '600' }]}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Text style={[Type.subheadline, { color: colors.label, fontWeight: '600' }]}>
          {t('diary.finalize.title', { day: currentDay })}
        </Text>
        <View style={styles.headerSideBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero block ── */}
        <View style={[styles.heroBlock, { backgroundColor: colors.bg2 }]}>
          <Text style={styles.heroIcon}>✅</Text>
          <Text style={[Type.title2, { color: colors.label, textAlign: 'center', marginBottom: 8 }]}>
            {t('diary.finalize.heroTitle')}
          </Text>
          <Text style={[Type.footnote, { color: colors.label2, textAlign: 'center', lineHeight: 20 }]}>
            {t('diary.finalize.heroSub', {
              photos: diaryPhotos.length,
              days: durationDays,
            })}
          </Text>
        </View>

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.bg2 }]}>
            <Text style={styles.statEmoji}>📸</Text>
            <Text style={[Type.title2, { color: colors.label }]}>{diaryPhotos.length}</Text>
            <Text style={[Type.caption1, { color: colors.label2, textAlign: 'center' }]}>
              {t('diary.finalize.statPhotos')}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bg2 }]}>
            <Text style={styles.statEmoji}>📅</Text>
            <Text style={[Type.title2, { color: colors.label }]}>
              {daysWithPhotos}/{durationDays}
            </Text>
            <Text style={[Type.caption1, { color: colors.label2, textAlign: 'center' }]}>
              {t('diary.finalize.statDays')}
            </Text>
          </View>
          <View style={[styles.statCardWide, { backgroundColor: colors.bg2 }]}>
            <Text style={styles.statEmoji}>💯</Text>
            <Text style={[Type.title2, { color: colors.label }]}>{attendancePct} %</Text>
            <Text style={[Type.caption1, { color: colors.label2, textAlign: 'center' }]}>
              {t('diary.finalize.statAttendance')}
            </Text>
          </View>
        </View>

        {/* ── Last photo section ── */}
        <View style={styles.sectionHeader}>
          <Text style={[Type.footnote, styles.sectionTitle, { color: colors.label2 }]}>
            {t('diary.finalize.lastPhotosSection')}
          </Text>
        </View>
        <Pressable
          onPress={pick}
          disabled={isUploading}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.lastPhotoBox,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep,
              opacity: pressed || isUploading ? 0.7 : 1,
            },
          ]}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : (
            <>
              <Text style={styles.lastPhotoEmoji}>📷</Text>
              <Text style={[Type.subheadline, { color: colors.label, fontWeight: '600', marginTop: 8 }]}>
                {t('diary.finalize.lastPhotosCta')}
              </Text>
              <Text style={[Type.caption1, { color: colors.label2, marginTop: 2 }]}>
                {t('diary.finalize.lastPhotosHint')}
              </Text>
            </>
          )}
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Pinned action bar ── */}
      <View
        style={[
          styles.actionBar,
          {
            backgroundColor: colors.bg,
            borderTopColor: colors.sep2,
          },
        ]}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.submitBtn,
            { backgroundColor: colors.gold, opacity: pressed || isSubmitting ? 0.7 : 1 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={[Type.subheadline, { color: colors.onAccent, fontWeight: '600' }]}>
              {t('diary.finalize.submitCta')}
            </Text>
          )}
        </Pressable>
        <Pressable
          onPress={handleAddMore}
          disabled={isSubmitting}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.addMoreBtn,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep2,
              opacity: pressed || isSubmitting ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[Type.footnote, { color: colors.label, fontWeight: '600' }]}>
            {t('diary.finalize.addMoreCta')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

export default DiaryFinalizeScreen

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSideBtn: {
    minWidth: 60,
  },

  scroll: {
    paddingBottom: 20,
  },

  // Hero
  heroBlock: {
    margin: 20,
    marginBottom: 0,
    padding: 24,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  heroIcon: {
    fontSize: 48,
    marginBottom: 8,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statCardWide: {
    flexBasis: '100%',
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statEmoji: {
    fontSize: 24,
  },

  // Section header
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Last photo box
  lastPhotoBox: {
    marginHorizontal: 20,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  lastPhotoEmoji: {
    fontSize: 32,
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  addMoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  },
})
