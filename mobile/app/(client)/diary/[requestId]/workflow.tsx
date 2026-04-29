/**
 * Diary Workflow Screen — 7-day live photo stream.
 *
 * Layout (per prototype diary-workflow.html):
 *   1. Page header: "Foto-deník" title + "Den X ze N · Coach" sub-line.
 *   2. Progress banner: day counter + dot strip + days-left sub-text.
 *   3. "Add photo today" primary CTA (gold button).
 *   4. Today's photos section: 2-col grid filtered to client-local-today.
 *   5. Previous days section: list rows grouped by day (Day N · date / N photos).
 *   6. Coach note strip.
 *   7. Finalize CTA — visible only on day N (currentDay >= durationDays).
 *
 * Data:
 *   - Request metadata: getDiaryRequestById (query key: ['diary-request', requestId]).
 *   - Photos: getPlanPhotos for the request's planId (query key: ['plan-photos', planId])
 *     filtered to diaryRequestId === request.id.
 *   - SignalR: planphotouploaded → invalidates photos; photoDiarySubmitted → navigates away.
 *
 * Upload pipeline: same as plan-photos.tsx (#66) — generatePlanPhotoUploadUrl +
 * finalizePlanPhoto with diaryRequestId threaded through.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  useColorScheme,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/stores/themeStore'
import { useImagePicker } from '@/hooks/useImagePicker'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { goldAlpha } from '@/constants/colors'
import {
  getDiaryRequestById,
  type ClientPhotoDiaryRequestSummary,
} from '@/api/diaryRequests'
import {
  getPlanPhotos,
  generatePlanPhotoUploadUrl,
  finalizePlanPhoto,
  PlanPhotoCategory,
  type PlanPhotoResponse,
} from '@/api/planPhotos'
import { onEvent } from '@/api/signalr'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { Toast } from '@/lib/toast'
import { href } from '@/lib/navigation'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute the current day number for a workflow request. */
function computeCurrentDay(
  acceptedAt: string | undefined,
  durationDays: number,
): number {
  if (!acceptedAt) return 1
  const msPerDay = 24 * 60 * 60 * 1000
  const daysSince = Math.floor((Date.now() - new Date(acceptedAt).getTime()) / msPerDay)
  return Math.min(daysSince + 1, durationDays)
}

/** ISO date string for the start of a given workflow day (midnight local). */
function dayStartDate(acceptedAt: string, dayIndex: number): Date {
  const accepted = new Date(acceptedAt)
  // Reset to midnight local of accepted-at day, then add dayIndex days.
  const base = new Date(accepted.getFullYear(), accepted.getMonth(), accepted.getDate())
  base.setDate(base.getDate() + dayIndex)
  return base
}

/** True if a photo's dateCreated falls on the client's local today. */
function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

/** Day index (0-based) a photo belongs to, relative to acceptedAt midnight. */
function photoDayIndex(dateStr: string | undefined, acceptedAt: string): number {
  if (!dateStr) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  const acceptedMidnight = new Date(
    new Date(acceptedAt).getFullYear(),
    new Date(acceptedAt).getMonth(),
    new Date(acceptedAt).getDate(),
  ).getTime()
  return Math.max(0, Math.floor((new Date(dateStr).getTime() - acceptedMidnight) / msPerDay))
}

/** Format a Date as short locale date string. */
function formatShortDate(date: Date, lng: string): string {
  return date.toLocaleDateString(lng, { weekday: 'short', day: 'numeric', month: 'numeric' })
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviousDayGroup {
  dayNumber: number   // 1-based
  dayIndex: number    // 0-based (0 = Day 1)
  date: Date
  photos: PlanPhotoResponse[]
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function DiaryWorkflowScreen() {
  const colors = useTheme()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()
  const systemScheme = useColorScheme()
  const preference = useThemeStore((s) => s.preference)
  const effectiveScheme = preference === 'system' ? (systemScheme ?? 'light') : preference

  const goldBg = effectiveScheme === 'dark' ? goldAlpha['10'] : goldAlpha['08']
  const goldBorder = effectiveScheme === 'dark' ? goldAlpha['25'] : goldAlpha['20']

  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  // ── Lightbox state ──
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxNotes, setLightboxNotes] = useState<(string | null)[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

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
  const isFinalDay = currentDay >= durationDays

  // ── Query: plan photos filtered to this diary request ──
  const planId = request?.planId
  const photosQuery = useQuery<PlanPhotoResponse[]>({
    queryKey: ['plan-photos', planId],
    queryFn: () => getPlanPhotos(planId ?? '', 1, 200),
    enabled: !!planId,
    staleTime: 30_000,
  })

  // Photos belonging to this diary request
  const diaryPhotos = useMemo(
    () => (photosQuery.data ?? []).filter((p) => p.diaryRequestId === requestId),
    [photosQuery.data, requestId],
  )

  // Today's photos
  const todayPhotos = useMemo(
    () => diaryPhotos.filter((p) => isToday(p.dateCreated)),
    [diaryPhotos],
  )

  // Previous day groups (days before today, each with their photos)
  const previousDayGroups = useMemo((): PreviousDayGroup[] => {
    if (!request?.acceptedAt) return []

    // We only show days 0..currentDay-2 (i.e., completed days before today)
    const groups: PreviousDayGroup[] = []
    for (let idx = 0; idx < currentDay - 1; idx++) {
      const date = dayStartDate(request.acceptedAt, idx)
      const dayNumber = idx + 1
      const photos = diaryPhotos.filter(
        (p) => photoDayIndex(p.dateCreated, request.acceptedAt!) === idx,
      )
      groups.push({ dayNumber, dayIndex: idx, date, photos })
    }
    // Show most recent first
    return groups.slice().reverse()
  }, [diaryPhotos, currentDay, request?.acceptedAt])

  // ── SignalR: invalidate photos when new upload arrives ──
  useEffect(() => {
    const off = onEvent('planphotouploaded', (payload: unknown) => {
      const data = payload as { planId?: string } | null
      if (!data?.planId || data.planId === planId) {
        queryClient.invalidateQueries({ queryKey: ['plan-photos', planId] })
      }
    })
    return off
  }, [planId, queryClient])

  // ── SignalR: navigate away when diary is submitted (auto-close or manual) ──
  useEffect(() => {
    const off = onEvent('photodiarysubmitted', (payload: unknown) => {
      const data = payload as { diaryRequestId?: string } | null
      if (!data?.diaryRequestId || data.diaryRequestId === requestId) {
        queryClient.invalidateQueries({ queryKey: ['active-workflow-diary-requests'] })
        queryClient.invalidateQueries({ queryKey: ['diary-request', requestId] })
        // Navigate back to Today — the diary is done
        router.replace(href('/(client)/(tabs)'))
      }
    })
    return off
  }, [requestId, router, queryClient])

  // ── Finalize photo mutation ──
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

  // ── Image picker ──
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

  // ── Lightbox helpers ──
  const openLightboxForPhotos = useCallback(
    (photos: PlanPhotoResponse[], index: number) => {
      setLightboxImages(photos.map((p) => p.blobUrl ?? '').filter(Boolean))
      setLightboxNotes(photos.map((p) => p.description ?? null))
      setLightboxIndex(index)
      setLightboxVisible(true)
    },
    [],
  )

  // ── Grid tile size (2 columns) ──
  const MARGIN = 20
  const GAP = 10
  const tileSize = (width - MARGIN * 2 - GAP) / 2

  // ── Loading state ──
  if (requestQuery.isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    )
  }

  // ── Completed state (shouldn't normally render — SignalR redirects) ──
  if (request?.status === 'Completed') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={[styles.closeBtn, { backgroundColor: colors.fill }]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.label2} />
          </Pressable>
          <Text style={[Type.headline, { color: colors.label }]}>
            {t('diary.workflow.title')}
          </Text>
          <View style={styles.closeBtnSpacer} />
        </View>
        <View style={styles.centered}>
          <Text style={[Type.largeTitle, { textAlign: 'center' }]}>✅</Text>
          <Text style={[Type.title3, { color: colors.label, marginTop: 12, textAlign: 'center' }]}>
            {t('diary.workflow.completedTitle')}
          </Text>
          <Text style={[Type.footnote, { color: colors.label2, marginTop: 8, textAlign: 'center' }]}>
            {t('diary.workflow.completedSub')}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const daysLeft = Math.max(0, durationDays - currentDay)
  const daysLeftKey =
    daysLeft === 1
      ? 'diary.workflow.daysLeft_one'
      : daysLeft < 5
        ? 'diary.workflow.daysLeft_few'
        : 'diary.workflow.daysLeft_many'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={[styles.closeBtn, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.label2} />
        </Pressable>
        <View style={styles.headerTextBlock}>
          <Text style={[Type.headline, { color: colors.label }]} numberOfLines={1}>
            {t('diary.workflow.title')}
          </Text>
          {request && (
            <Text style={[Type.caption1, { color: colors.label2 }]} numberOfLines={1}>
              {t('diary.workflow.headerSub', {
                day: currentDay,
                total: durationDays,
                name: '',
              }).replace(' · ', '')}
            </Text>
          )}
        </View>
        <View style={styles.closeBtnSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Progress banner ── */}
        <View
          style={[
            styles.progressBanner,
            {
              backgroundColor: goldBg,
              borderColor: goldBorder,
            },
          ]}
        >
          <View style={styles.progressTopRow}>
            <Text style={[Type.headline, { color: colors.label }]}>
              {t('diary.workflow.dayCounter', { day: currentDay, total: durationDays })}
            </Text>
            <View style={styles.dots}>
              {Array.from({ length: durationDays }).map((_, i) => {
                const isDone = i < currentDay - 1
                const isCurrent = i === currentDay - 1
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      isDone
                        ? { backgroundColor: colors.gold }
                        : isCurrent
                          ? {
                              backgroundColor: 'transparent',
                              borderWidth: 1.5,
                              borderColor: colors.gold,
                            }
                          : { backgroundColor: colors.fill },
                    ]}
                  />
                )
              })}
            </View>
          </View>
          <Text style={[Type.caption1, { color: colors.label2, marginTop: 6 }]}>
            {daysLeft > 0
              ? `${t(daysLeftKey, { count: daysLeft })} · ${t('diary.workflow.photosCount', { count: diaryPhotos.length })}`
              : t('diary.workflow.photosCount', { count: diaryPhotos.length })}
          </Text>
        </View>

        {/* ── Add photo CTA ── */}
        <Pressable
          onPress={pick}
          disabled={isUploading}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.addPhotoCta,
            { backgroundColor: colors.gold, opacity: pressed || isUploading ? 0.7 : 1 },
          ]}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={[Type.subheadline, { color: colors.onAccent, fontWeight: '600' }]}>
              + {t('diary.workflow.addPhoto')}
            </Text>
          )}
        </Pressable>

        {/* ── Today's photos ── */}
        <View style={styles.sectionHeader}>
          <Text style={[Type.footnote, styles.sectionTitle, { color: colors.label2 }]}>
            {todayPhotos.length > 0
              ? t('diary.workflow.todaySection', { count: todayPhotos.length })
              : t('diary.workflow.todaySectionEmpty')}
          </Text>
        </View>

        {todayPhotos.length === 0 ? (
          <View style={[styles.emptyTodayBox, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}>
            <Ionicons name="camera-outline" size={28} color={colors.label3} />
            <Text style={[Type.footnote, { color: colors.label3, marginTop: 6 }]}>
              {t('diary.workflow.addPhoto')}
            </Text>
          </View>
        ) : (
          <View style={[styles.photoGrid, { paddingHorizontal: MARGIN }]}>
            {todayPhotos.map((photo, index) => (
              <Pressable
                key={photo.id ?? index}
                onPress={() => openLightboxForPhotos(todayPhotos, index)}
                accessibilityRole="button"
                style={[styles.tile, { width: tileSize, height: tileSize, backgroundColor: colors.fill2 }]}
              >
                <Image
                  source={{ uri: photo.blobUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
                {photo.description ? (
                  <View style={[styles.tileCaption, { backgroundColor: colors.overlay }]}>
                    <Text style={[styles.tileCaptionText, { color: colors.onAccent }]} numberOfLines={1}>
                      {photo.description}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        {/* ── Previous days ── */}
        {previousDayGroups.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[Type.footnote, styles.sectionTitle, { color: colors.label2 }]}>
                {t('diary.workflow.previousSection')}
              </Text>
            </View>

            <View style={[styles.listCard, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}>
              {previousDayGroups.map((group, groupIndex) => {
                const countKey =
                  group.photos.length === 1
                    ? 'diary.workflow.previousPhotoCount_one'
                    : group.photos.length < 5
                      ? 'diary.workflow.previousPhotoCount_few'
                      : 'diary.workflow.previousPhotoCount_many'
                return (
                  <React.Fragment key={group.dayIndex}>
                    {groupIndex > 0 && (
                      <View style={[styles.separator, { backgroundColor: colors.sep2 }]} />
                    )}
                    <Pressable
                      onPress={() => {
                        if (group.photos.length > 0) {
                          openLightboxForPhotos(group.photos, 0)
                        }
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.listRow,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: colors.goldBg }]}>
                        <Text style={styles.rowIconEmoji}>📸</Text>
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={[Type.subheadline, { color: colors.label }]}>
                          {t('diary.workflow.previousDayRow', {
                            day: group.dayNumber,
                            date: formatShortDate(group.date, i18n.language),
                          })}
                        </Text>
                        <Text style={[Type.caption1, { color: colors.label2 }]}>
                          {t(countKey, { count: group.photos.length })}
                        </Text>
                      </View>
                      {group.photos.length > 0 && (
                        <Text style={[Type.headline, { color: colors.label3 }]}>›</Text>
                      )}
                    </Pressable>
                  </React.Fragment>
                )
              })}
            </View>
          </>
        )}

        {/* ── Coach note ── */}
        <View
          style={[
            styles.coachNote,
            { backgroundColor: colors.bg2, borderColor: colors.sep2 },
          ]}
        >
          <Text style={[Type.footnote, { color: colors.label2, lineHeight: 20 }]}>
            {t('diary.workflow.coachNote', { name: '' }).trim().replace(/^·\s*/, '')}
          </Text>
        </View>

        {/* ── Finalize CTA — only on day N ── */}
        {isFinalDay && (
          <Pressable
            onPress={() => router.push(href(`/(client)/diary/${requestId}/finalize`))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.finalizeBtn,
              { borderColor: colors.gold, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[Type.subheadline, { color: colors.gold, fontWeight: '600' }]}>
              {t('diary.workflow.finalizeCtaLabel')}
            </Text>
          </Pressable>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── Lightbox ── */}
      <ImageLightbox
        visible={lightboxVisible}
        images={lightboxImages}
        startIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
        imageNotes={lightboxNotes}
      />
    </SafeAreaView>
  )
}

export default DiaryWorkflowScreen

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeBtnSpacer: {
    width: 32,
    flexShrink: 0,
  },

  scroll: {
    paddingBottom: 40,
  },

  // Progress banner
  progressBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    padding: 16,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Add photo CTA
  addPhotoCta: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 48,
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

  // Empty today state
  emptyTodayBox: {
    marginHorizontal: 20,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },

  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  tileCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tileCaptionText: {
    fontSize: 11,
  },

  // List card (previous days)
  listCard: {
    marginHorizontal: 20,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16 + 36 + 12, // indent past icon
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowIconEmoji: {
    fontSize: 16,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },

  // Coach note
  coachNote: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },

  // Finalize CTA
  finalizeBtn: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    borderWidth: 1.5,
  },

  bottomSpacer: {
    height: 20,
  },
})
