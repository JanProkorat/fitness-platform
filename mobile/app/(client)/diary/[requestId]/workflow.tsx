/**
 * Diary Workflow Screen — multi-day live photo stream.
 *
 * Layout:
 *   1. Page header: "Foto-deník" title + "Den X ze N" sub-line.
 *   2. Pinned dashed "Add photos" picker card — stays visible while the
 *      photos grid below scrolls.
 *   3. Scrollable body:
 *        a. Staged photos (picked, not yet uploaded) — caption + remove per
 *           tile, status badge per tile (mirrors the bulk page exactly).
 *        b. All uploaded photos for this diary, newest first.
 *        c. Finalize CTA — visible only on day N (currentDay >= durationDays).
 *   4. Pinned bottom action bar: gold "Add today's photos" submit button —
 *      runs the staged batch through the upload pipeline (does NOT submit
 *      the diary; the diary auto-finalizes on day N+1 or via the day-N
 *      finalize CTA).
 *
 * Data:
 *   - Request metadata: getDiaryRequestById (query key: ['diary-request', requestId]).
 *   - Photos: getPlanPhotos for the request's planId (query key: ['plan-photos', planId])
 *     filtered to diaryRequestId === request.id.
 *   - SignalR: planphotouploaded → invalidates photos; photoDiarySubmitted → navigates away.
 *
 * Upload pipeline: same as plan-photos.tsx (#66) — generatePlanPhotoUploadUrl +
 * finalizePlanPhoto with diaryRequestId threaded through. The picker stages
 * photos locally so the user can type a caption before the daily-batch submit.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
  ActionSheetIOS,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { useDiaryRequestState } from '@/hooks/useDiaryRequestState'
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
import { transcodeHeicToJpeg } from '@/lib/heicTranscode'

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

/** Best-available timestamp for sorting/displaying a photo. Server returns
 *  takenAt + dateCreated; we prefer takenAt when present and fall back to
 *  dateCreated so newly-uploaded photos still sort correctly. */
function photoTimestamp(p: PlanPhotoResponse): string {
  return p.takenAt ?? p.dateCreated ?? ''
}

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

function getMimeType(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  return MIME_MAP[ext] ?? 'image/jpeg'
}

let _idCounter = 0
function nextLocalId(): string {
  _idCounter += 1
  return `local-${Date.now()}-${_idCounter}`
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PhotoStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

interface PhotoEntry {
  localId: string
  localUri: string
  caption: string
  status: PhotoStatus
  remoteUrl?: string
  errorMsg?: string
}

type PhotoAction =
  | { type: 'ADD_PHOTOS'; entries: PhotoEntry[] }
  | { type: 'SET_STATUS'; localId: string; status: PhotoStatus; remoteUrl?: string; errorMsg?: string }
  | { type: 'SET_CAPTION'; localId: string; caption: string }
  | { type: 'REMOVE'; localId: string }
  | { type: 'CLEAR' }

function photosReducer(state: PhotoEntry[], action: PhotoAction): PhotoEntry[] {
  switch (action.type) {
    case 'ADD_PHOTOS':
      return [...state, ...action.entries]
    case 'SET_STATUS':
      return state.map((p) =>
        p.localId === action.localId
          ? {
              ...p,
              status: action.status,
              remoteUrl: action.remoteUrl ?? p.remoteUrl,
              errorMsg: action.status === 'failed' ? action.errorMsg : undefined,
            }
          : p,
      )
    case 'SET_CAPTION':
      return state.map((p) =>
        p.localId === action.localId ? { ...p, caption: action.caption } : p,
      )
    case 'REMOVE':
      return state.filter((p) => p.localId !== action.localId)
    case 'CLEAR':
      return []
    default:
      return state
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function DiaryWorkflowScreen() {
  const colors = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()

  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  // ── Lightbox state ──
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxNotes, setLightboxNotes] = useState<(string | null)[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ── Local-staged photos (picked, not yet uploaded) ──
  const [staged, dispatch] = useReducer(photosReducer, [])
  const [picking, setPicking] = useState(false)
  const stagedRef = useRef(staged)
  stagedRef.current = staged

  // ── Query: diary request metadata ──
  // The query + the requestFailed/missingPlan derivation both live in
  // useDiaryRequestState (#782/#798) — see that hook for the full rationale.
  const {
    request,
    planId,
    isLoading: requestIsLoading,
    requestFailed,
    missingPlan,
    refetch: refetchRequest,
  } = useDiaryRequestState(requestId, 60_000)

  const durationDays = request?.durationDays ?? 7
  const currentDay = computeCurrentDay(request?.acceptedAt, durationDays)
  const isFinalDay = currentDay >= durationDays

  // ── Query: plan photos filtered to this diary request ──
  // Backend validator caps `pageSize` at 100 — passing more (e.g. 200) returns
  // a 400 and we silently get an empty list. 100 is plenty: even a 14-day
  // diary with 5 photos/day tops out around 70 entries, well under the cap.
  const photosQuery = useQuery<PlanPhotoResponse[]>({
    queryKey: ['plan-photos', planId],
    queryFn: () => getPlanPhotos(planId ?? '', 1, 100),
    enabled: !!planId,
    // Always refetch when the screen mounts. Without this, navigating away
    // and back hits the cached list — which does not include photos uploaded
    // in the meantime if the cache hasn't been invalidated by SignalR yet.
    refetchOnMount: 'always',
    staleTime: 0,
  })

  // All photos uploaded for this diary request, newest first. We no longer
  // split into "today" vs "previous days" — that bucketing relied on
  // `dateCreated` matching the client's local "today" exactly, which broke
  // around UTC/local boundaries and hid the user's earlier uploads behind a
  // collapsed list row. Showing every photo in one grid is what the client
  // actually wants when they reopen the diary mid-period.
  const diaryPhotos = useMemo(() => {
    const list = (photosQuery.data ?? []).filter(
      (p) => p.diaryRequestId === requestId,
    )
    return list
      .slice()
      .sort((a, b) => photoTimestamp(b).localeCompare(photoTimestamp(a)))
  }, [photosQuery.data, requestId])

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

  // ── SignalR: navigate away when diary is submitted ──
  useEffect(() => {
    const off = onEvent('photodiarysubmitted', (payload: unknown) => {
      const data = payload as { diaryRequestId?: string } | null
      if (!data?.diaryRequestId || data.diaryRequestId === requestId) {
        queryClient.invalidateQueries({ queryKey: ['active-diary-requests'] })
        queryClient.invalidateQueries({ queryKey: ['diary-request', requestId] })
        router.replace(href('/(client)/(tabs)'))
      }
    })
    return off
  }, [requestId, router, queryClient])

  // ── Picker (stage-only, mirrors bulk.tsx) ──
  const ensureLibraryPermission = useCallback(async (): Promise<boolean> => {
    const result = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (result.status !== 'granted') {
      Toast.show(t('imagePicker.permissionDenied'))
      return false
    }
    return true
  }, [t])

  const ensureCameraPermission = useCallback(async (): Promise<boolean> => {
    const result = await ImagePicker.requestCameraPermissionsAsync()
    if (result.status !== 'granted') {
      Toast.show(t('imagePicker.permissionDenied'))
      return false
    }
    return true
  }, [t])

  const selectSource = useCallback((): Promise<'camera' | 'library' | 'cancel'> => {
    return new Promise((resolve) => {
      const cameraLabel = t('imagePicker.sourceCamera')
      const libraryLabel = t('imagePicker.sourceLibrary')
      const cancelLabel = t('common.cancel')

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: [cancelLabel, cameraLabel, libraryLabel], cancelButtonIndex: 0 },
          (idx) => {
            if (idx === 1) resolve('camera')
            else if (idx === 2) resolve('library')
            else resolve('cancel')
          },
        )
      } else {
        Alert.alert(
          t('imagePicker.sourceTitle'),
          undefined,
          [
            { text: cameraLabel, onPress: () => resolve('camera') },
            { text: libraryLabel, onPress: () => resolve('library') },
            { text: cancelLabel, style: 'cancel', onPress: () => resolve('cancel') },
          ],
          { cancelable: true, onDismiss: () => resolve('cancel') },
        )
      }
    })
  }, [t])

  const handlePick = useCallback(async () => {
    if (picking) return
    if (!planId) {
      Toast.show(t('common.error'))
      return
    }

    setPicking(true)
    try {
      const source = await selectSource()
      if (source === 'cancel') return

      const needCamera = source === 'camera'
      const hasLibrary = await ensureLibraryPermission()
      if (!hasLibrary) return
      if (needCamera) {
        const hasCam = await ensureCameraPermission()
        if (!hasCam) return
      }

      let result: ImagePicker.ImagePickerResult
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.85,
        })
      }

      if (result.canceled || result.assets.length === 0) return

      const transcodedUris = await Promise.all(
        result.assets.map((asset) => transcodeHeicToJpeg(asset.uri)),
      )

      const newEntries: PhotoEntry[] = transcodedUris.map((uri) => ({
        localId: nextLocalId(),
        localUri: uri,
        caption: '',
        status: 'pending' as PhotoStatus,
      }))

      dispatch({ type: 'ADD_PHOTOS', entries: newEntries })
    } finally {
      setPicking(false)
    }
  }, [picking, planId, selectSource, ensureLibraryPermission, ensureCameraPermission, t])

  // ── Upload one staged entry ──
  const uploadEntry = useCallback(
    async (localId: string, effectivePlanId: string): Promise<void> => {
      const entry = stagedRef.current.find((p) => p.localId === localId)
      if (!entry) return

      dispatch({ type: 'SET_STATUS', localId, status: 'uploading' })
      try {
        const contentType = getMimeType(entry.localUri)
        const fileResponse = await fetch(entry.localUri)
        const blob = await fileResponse.blob()

        const { uploadUrl, blobUrl } = await generatePlanPhotoUploadUrl(
          effectivePlanId,
          contentType,
          blob.size,
        )

        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob,
        })
        if (!putResponse.ok) {
          throw new Error(`PUT ${putResponse.status} ${putResponse.statusText}`)
        }

        const latest = stagedRef.current.find((p) => p.localId === localId)
        const caption = latest?.caption?.trim() || undefined

        await finalizePlanPhoto(effectivePlanId, {
          blobUrl,
          description: caption,
          category: PlanPhotoCategory.FreeForm,
          diaryRequestId: requestId,
        })

        dispatch({
          type: 'SET_STATUS',
          localId,
          status: 'uploaded',
          remoteUrl: blobUrl,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        dispatch({
          type: 'SET_STATUS',
          localId,
          status: 'failed',
          errorMsg: msg,
        })
        throw e
      }
    },
    [requestId],
  )

  // ── Daily-batch submit mutation ──
  // Uploads every 'pending' or 'failed' staged entry. Does NOT call the diary
  // /submit endpoint — that's the day-N "Odevzdat deník" CTA. Workflow auto-
  // finalizes server-side on day N+1.
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error('planId not loaded')
      const outstanding = stagedRef.current.filter(
        (p) => p.status === 'pending' || p.status === 'failed',
      )
      if (outstanding.length === 0) return
      const results = await Promise.allSettled(
        outstanding.map((p) => uploadEntry(p.localId, planId)),
      )
      const anyFailed = results.some((r) => r.status === 'rejected')
      if (anyFailed) throw new Error('upload-failed')
    },
    onSuccess: () => {
      // Fire-and-forget invalidation — awaiting the refetch here keeps the
      // mutation in `isPending` state and freezes the gold submit button on
      // its spinner. The page is about to dismiss anyway; on the next mount
      // `refetchOnMount: 'always'` re-pulls the photos with the fresh upload.
      queryClient.invalidateQueries({ queryKey: ['plan-photos', planId] })
      queryClient.invalidateQueries({ queryKey: ['active-diary-requests'] })
      dispatch({ type: 'CLEAR' })
      Toast.show(t('diary.workflow.todayUploadedToast'))
      router.back()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      Toast.show(t(msg === 'upload-failed' ? 'diary.bulk.errorUpload' : 'diary.bulk.errorSubmit'))
    },
  })

  const handleRetry = useCallback((entry: PhotoEntry) => {
    dispatch({ type: 'SET_STATUS', localId: entry.localId, status: 'pending' })
  }, [])

  const handleRemove = useCallback((localId: string) => {
    dispatch({ type: 'REMOVE', localId })
  }, [])

  const handleCaptionChange = useCallback((localId: string, value: string) => {
    dispatch({ type: 'SET_CAPTION', localId, caption: value })
  }, [])

  const stagedUploadingCount = staged.filter((p) => p.status === 'uploading').length
  const canSubmitStaged = staged.length > 0 && stagedUploadingCount === 0
  const isSubmittingStaged = submitMutation.isPending
  const submitDisabled = !canSubmitStaged || isSubmittingStaged

  // ── Lightbox helpers ──
  // Render `displayUrl` (short-lived signed URL) — never `blobUrl`, which is
  // identity-only and not directly fetchable. Map without filtering so the
  // images/notes arrays stay index-aligned with `photos` (the caller passes
  // the tapped tile's own index into this array); ImageLightbox renders a
  // placeholder for an empty entry.
  const openLightboxForPhotos = useCallback(
    (photos: PlanPhotoResponse[], index: number) => {
      setLightboxImages(photos.map((p) => p.displayUrl ?? ''))
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
  // Guardrail: this MUST stay `isLoading`, never `isPending`. With
  // `requestId` absent the query is `enabled: false`, so `isPending` stays
  // `true` forever — swapping this would turn the card-level infinite
  // spinner this issue fixes into a worse, full-screen infinite spinner.
  // The missing-requestId case falls through to the pinned card below and
  // is caught by `requestFailed`.
  if (requestIsLoading) {
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
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.gold} />
            <Text style={[Type.body, styles.backLabel, { color: colors.gold }]}>
              {t('common.back')}
            </Text>
          </Pressable>
          <Text style={[Type.headline, { color: colors.label }]}>
            {t('diary.workflow.title')}
          </Text>
          <View style={styles.headerSpacer} />
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Ionicons name="chevron-back" size={26} color={colors.gold} />
          <Text style={[Type.body, styles.backLabel, { color: colors.gold }]}>
            {t('common.back')}
          </Text>
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
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Pinned picker card (stays visible while the photos below scroll) ── */}
      <View style={styles.pickerArea}>
        {requestFailed ? (
          // Hard fetch failure (network / server), or `requestId` never
          // arrived as a route param — surfaced with a retry instead of
          // leaving the card spinning forever (#782/#798). Refetching a
          // query with no `requestId` is a no-op, so the retry action is
          // only offered when there's an actual query to retry.
          <View
            style={[
              styles.addCard,
              styles.stateCard,
              { backgroundColor: colors.bg2, borderColor: colors.red },
            ]}
          >
            <Text style={[Type.callout, styles.addCardTitle, styles.stateText, { color: colors.label }]}>
              {t('diary.bulk.errorLoadRequest')}
            </Text>
            {requestId ? (
              <Pressable
                onPress={() => refetchRequest()}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.retryLoadBtn,
                  { backgroundColor: colors.gold, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[Type.subheadline, styles.retryLoadLabel, { color: colors.onAccent }]}>
                  {t('diary.bulk.retryLoad')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : missingPlan ? (
          // Query settled successfully but the request has no plan attached
          // (a valid backend state — CreateRequestRequest.PlanId is
          // optional) or the request could not be found. Upload is
          // structurally impossible without a planId, so say so explicitly
          // instead of disabling the button forever with no explanation
          // (#782/#798).
          <View
            style={[
              styles.addCard,
              styles.stateCard,
              { backgroundColor: colors.bg2, borderColor: colors.sep },
            ]}
          >
            <Text style={[Type.callout, styles.addCardTitle, styles.stateText, { color: colors.label }]}>
              {t('diary.bulk.noPlanError')}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={handlePick}
            disabled={picking || !planId}
            accessibilityRole="button"
            accessibilityState={{ disabled: picking || !planId }}
            style={({ pressed }) => [
              styles.addCard,
              {
                backgroundColor: colors.bg2,
                borderColor: colors.sep,
                opacity: picking || !planId ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {picking || !planId ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <>
                <Text style={[Type.caption1, styles.addCardHintTop, { color: colors.label3 }]}>
                  {t('diary.bulk.hint')}
                </Text>
                <Text style={styles.addCardIcon}>📷</Text>
                <Text style={[Type.callout, styles.addCardTitle, { color: colors.label }]}>
                  {t('diary.bulk.addPhotos')}
                </Text>
                <Text style={[Type.caption1, styles.addCardHint, { color: colors.label2 }]}>
                  {t('diary.bulk.addPhotosHint')}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Staged photo grid (picked, not yet uploaded) ── */}
        {staged.length > 0 && (
          <View style={[styles.stagedGrid, { paddingHorizontal: MARGIN }]}>
            {staged.map((entry, idx) => (
              <PhotoTile
                key={entry.localId}
                entry={entry}
                tileWidth={tileSize}
                index={idx}
                colors={colors}
                onCaptionChange={handleCaptionChange}
                onRemove={handleRemove}
                onRetry={handleRetry}
                t={t}
              />
            ))}
          </View>
        )}

        {/* ── All uploaded photos for this diary, newest first ── */}
        {diaryPhotos.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[Type.footnote, styles.sectionTitle, { color: colors.label2 }]}>
                {t('diary.workflow.uploadedSection', { count: diaryPhotos.length })}
              </Text>
            </View>
            <View style={[styles.photoGrid, { paddingHorizontal: MARGIN }]}>
              {diaryPhotos.map((photo, index) => (
                <Pressable
                  key={photo.id ?? index}
                  onPress={() => openLightboxForPhotos(diaryPhotos, index)}
                  accessibilityRole="button"
                  style={[styles.tile, { width: tileSize, height: tileSize, backgroundColor: colors.fill2 }]}
                >
                  {photo.displayUrl ? (
                    <Image
                      source={{ uri: photo.displayUrl }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={colors.label3} />
                  )}
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
          </>
        )}

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

      {/* ── Pinned bottom action bar — daily-batch submit ── */}
      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
        ]}
      >
        <Pressable
          onPress={() => submitMutation.mutate()}
          disabled={submitDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled }}
          style={({ pressed }) => [
            styles.ctaSubmit,
            {
              backgroundColor: colors.gold,
              opacity: submitDisabled ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
        >
          {isSubmittingStaged ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[Type.subheadline, styles.ctaLabel, { color: colors.onAccent }]}>
              {t('diary.workflow.addTodayPhotosCta')}
            </Text>
          )}
        </Pressable>
      </View>

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

// ─── PhotoTile (mirrors bulk.tsx) ────────────────────────────────────────────

interface PhotoTileProps {
  entry: PhotoEntry
  tileWidth: number
  index: number
  colors: ReturnType<typeof useTheme>
  onCaptionChange: (localId: string, value: string) => void
  onRemove: (localId: string) => void
  onRetry: (entry: PhotoEntry) => void
  t: ReturnType<typeof useTranslation>['t']
}

function PhotoTile({
  entry,
  tileWidth,
  index,
  colors,
  onCaptionChange,
  onRemove,
  onRetry,
  t,
}: PhotoTileProps) {
  const THUMB_HEIGHT = 140

  const statusBgColor =
    entry.status === 'uploaded'
      ? colors.green
      : entry.status === 'failed'
        ? colors.red
        : colors.orange

  return (
    <View
      style={[
        styles.stagedTile,
        {
          width: tileWidth,
          backgroundColor: colors.bg2,
          borderColor: entry.status === 'failed' ? colors.red : colors.sep2,
        },
      ]}
    >
      <View style={[styles.thumbContainer, { height: THUMB_HEIGHT }]}>
        <Image
          source={{ uri: entry.localUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${t('diary.bulk.removePhoto')} ${index + 1}`}
        />

        {entry.status !== 'pending' && (
          <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
            {entry.status === 'uploading' ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={[styles.statusBadgeText, { color: colors.onAccent }]}>
                {entry.status === 'uploaded'
                  ? t('diary.bulk.statusUploaded')
                  : t('diary.bulk.statusFailed')}
              </Text>
            )}
          </View>
        )}

        <Pressable
          onPress={() => onRemove(entry.localId)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('diary.bulk.removePhoto')}
          style={[styles.removeBtn, { backgroundColor: colors.overlay }]}
        >
          <Ionicons name="close" size={14} color={colors.onAccent} />
        </Pressable>
      </View>

      <TextInput
        style={[
          styles.captionInput,
          Type.caption1,
          { color: colors.label, borderTopColor: colors.sep2 },
        ]}
        placeholder={t('diary.bulk.captionPlaceholder')}
        placeholderTextColor={colors.label3}
        value={entry.caption}
        onChangeText={(v) => onCaptionChange(entry.localId, v)}
        returnKeyType="done"
        multiline={false}
        maxLength={200}
        accessibilityLabel={t('diary.bulk.captionPlaceholder')}
      />

      {entry.status === 'failed' && (
        <Pressable
          onPress={() => onRetry(entry)}
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: colors.red, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('diary.bulk.retryPhoto')}
        >
          <Text style={[Type.caption1, styles.retryBtnLabel, { color: colors.onAccent }]}>
            {t('diary.bulk.retryPhoto')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const EMOJI_LARGE = 32
const HEADER_SIDE_WIDTH = 92

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },

  // Header — matches the diary wizard (gold chevron + "Zpět" label)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: 'center',
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
  headerSpacer: {
    width: HEADER_SIDE_WIDTH,
    flexShrink: 0,
  },

  scroll: {
    paddingBottom: 40,
  },

  // Picker card (matches bulk.addCard)
  pickerArea: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  addCard: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addCardIcon: {
    fontSize: EMOJI_LARGE,
    lineHeight: EMOJI_LARGE + 2,
    marginVertical: 0,
  },
  addCardTitle: {
    fontWeight: '600',
  },
  addCardHint: {
    textAlign: 'center',
  },
  addCardHintTop: {
    textAlign: 'center',
    marginBottom: 4,
    lineHeight: 18,
  },

  // Error / no-plan state card (matches bulk.stateCard, #782/#798)
  stateCard: {
    borderStyle: 'solid',
    gap: 10,
  },
  stateText: {
    textAlign: 'center',
  },
  retryLoadBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  retryLoadLabel: {
    fontWeight: '600',
  },

  // Staged tiles grid (matches bulk.grid)
  stagedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 10,
  },
  stagedTile: {
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbContainer: {
    overflow: 'hidden',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.full,
    minWidth: 24,
    alignItems: 'center',
  },
  statusBadgeText: {
    ...Type.caption2,
    fontWeight: '600',
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  retryBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  retryBtnLabel: {
    fontWeight: '600',
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

  // Today's uploaded photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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

  // Pinned action bar
  actionBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 0.5,
  },
  ctaSubmit: {
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontWeight: '600',
  },
})
