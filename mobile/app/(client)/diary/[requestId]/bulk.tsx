/**
 * Diary bulk-upload screen.
 *
 * Implements #100: multi-photo picker, 2-column thumbnail grid with per-photo
 * caption inputs, per-photo upload status, remove and retry actions, submit CTA.
 *
 * Design-of-record: docs/prototypes/mobile/scenes/diary-bulk.html
 *
 * Flow:
 *  1. User taps "Add photos" → multi-select OS picker opens.
 *  2. Selected photos land in local state as 'pending', then immediately start
 *     uploading in parallel: generatePlanPhotoUploadUrl → PUT → finalizePlanPhoto
 *     (with diaryRequestId — transitions Accepted → InProgress on first upload).
 *  3. Failed photos keep their caption in state (AC #1) — retry button per photo.
 *  4. Submit is enabled only when ≥1 photo exists, none are uploading, and none
 *     are in a failed state (AC #2). User must retry or remove failures first.
 *  5. On Submit: POST /client/photo-diary-requests/{id}/submit, then invalidate
 *     active-diary-requests + pending-questionnaires queries, navigate to Today.
 */

import React, { useCallback, useReducer, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { generatePlanPhotoUploadUrl, finalizePlanPhoto } from '@/api/planPhotos'
import { submitDiaryRequest } from '@/api/diaryRequests'
import { useDiaryRequestState } from '@/hooks/useDiaryRequestState'
import { Toast } from '@/lib/toast'
import { transcodeHeicToJpeg } from '@/lib/heicTranscode'

// ─── Types ───────────────────────────────────────────────────────────────────

type PhotoStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

interface PhotoEntry {
  /** Stable unique ID for the entry (generated locally). */
  localId: string
  /** Local file URI from the image picker. */
  localUri: string
  /** User-entered caption — survives upload failures (AC #1). */
  caption: string
  status: PhotoStatus
  /** Permanent blob URL after successful upload. */
  remoteUrl?: string
  /** Error message shown under the tile on failure. */
  errorMsg?: string
}

// ─── State reducer ───────────────────────────────────────────────────────────

type PhotoAction =
  | { type: 'ADD_PHOTOS'; entries: PhotoEntry[] }
  | { type: 'SET_STATUS'; localId: string; status: PhotoStatus; remoteUrl?: string; errorMsg?: string }
  | { type: 'SET_CAPTION'; localId: string; caption: string }
  | { type: 'REMOVE'; localId: string }

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
              // Only clear errorMsg when transitioning away from 'failed'.
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
    default:
      return state
  }
}

// Decorative emoji glyph — no Type.* token covers emoji sizing per project precedent.
const EMOJI_LARGE = 32

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = 0
function nextLocalId(): string {
  _idCounter += 1
  return `local-${Date.now()}-${_idCounter}`
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

// ─── Screen ──────────────────────────────────────────────────────────────────

export function DiaryBulkScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()

  const { requestId } = useLocalSearchParams<{ requestId: string }>()

  // Fetch the request to derive the planId — the bulk screen is reachable both
  // from the wizard (just-accepted, no params) and from the Today resume banner,
  // neither of which threads planId through the URL. The PlanPhoto upload
  // pipeline requires it because photos are scoped to a plan, not a request.
  // The query + the requestFailed/missingPlan derivation both live in
  // useDiaryRequestState (#782/#798) — see that hook for the full rationale.
  const { planId, requestFailed, missingPlan, refetch: refetchRequest } = useDiaryRequestState(
    requestId,
    30_000,
  )

  // ── Photo list managed by a local reducer ────────────────────────────────────
  const [photos, dispatch] = useReducer(photosReducer, [])
  const [picking, setPicking] = useState(false)

  const uploadingCount = photos.filter((p) => p.status === 'uploading').length
  const uploadedCount = photos.filter((p) => p.status === 'uploaded').length
  const totalCount = photos.length

  // Submit enabled when ≥1 photo. The submit mutation itself runs uploads for
  // any 'pending' or 'failed' entries (with their captions intact) and only
  // POSTs /submit if every upload succeeded.
  const canSubmit = totalCount > 0 && uploadingCount === 0

  // Hold the latest photos array in a ref so the upload helper always reads
  // the user's most-recently-typed caption (the closure value would be stale
  // because uploads run from the submit handler, not from each pick).
  const photosRef = useRef(photos)
  photosRef.current = photos

  // ── Upload a single entry ────────────────────────────────────────────────────
  // Fetches the latest caption for this entry from `photosRef` at upload time,
  // not from the captured `entry` argument, so captions typed AFTER the photo
  // was picked still reach the backend.
  const uploadEntry = useCallback(
    async (localId: string, effectivePlanId: string): Promise<void> => {
      const entry = photosRef.current.find((p) => p.localId === localId)
      if (!entry) return

      dispatch({ type: 'SET_STATUS', localId, status: 'uploading' })
      try {
        const contentType = getMimeType(entry.localUri)

        // 1. Read the file first so we know its real byte size — the backend
        //    validator rejects sizeBytes <= 0 and > 5 MiB with a 400, so we
        //    must pass the actual blob length when requesting the signed URL.
        const fileResponse = await fetch(entry.localUri)
        const blob = await fileResponse.blob()

        // 2. Request presigned PUT URL with the correct content-type + size.
        const { uploadUrl, blobUrl } = await generatePlanPhotoUploadUrl(
          effectivePlanId,
          contentType,
          blob.size,
        )

        // 3. PUT the raw binary to the signed URL.
        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob,
        })
        if (!putResponse.ok) {
          throw new Error(`PUT ${putResponse.status} ${putResponse.statusText}`)
        }

        // 4. Finalize — read the caption from current state (not the captured
        //    entry from when the photo was picked) so user edits land too.
        const latest = photosRef.current.find((p) => p.localId === localId)
        const caption = latest?.caption?.trim() || undefined

        await finalizePlanPhoto(effectivePlanId, {
          blobUrl,
          description: caption,
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

  // ── Permission check helper ──────────────────────────────────────────────────
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

  // ── Source selection sheet (matches useImagePicker's pattern) ────────────────
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

  // ── Pick photos and queue them ─────────────────────────────────────────────
  // Photos are NOT uploaded here — they're queued in 'pending' state so the
  // user can type a caption first. The actual PUT + finalize happens at submit
  // time (see submitMutation), which means whatever caption the user typed
  // ends up on the backend.
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

      // Transcode HEIC/HEIF → JPEG so the trainer portal can render the photos
      // (browsers don't decode HEIC natively). No-op for other formats.
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

  // ── Retry a failed entry ─────────────────────────────────────────────────────
  const handleRetry = useCallback(
    (entry: PhotoEntry) => {
      if (!planId) return
      // Reset to pending; the next submit attempt will pick it up.
      dispatch({ type: 'SET_STATUS', localId: entry.localId, status: 'pending' })
    },
    [planId],
  )

  // ── Remove ────────────────────────────────────────────────────────────────────
  const handleRemove = useCallback((localId: string) => {
    dispatch({ type: 'REMOVE', localId })
  }, [])

  // ── Caption change ────────────────────────────────────────────────────────────
  const handleCaptionChange = useCallback((localId: string, value: string) => {
    dispatch({ type: 'SET_CAPTION', localId, caption: value })
  }, [])

  // ── Submit mutation ───────────────────────────────────────────────────────────
  // Two-phase: first uploads every photo that is still 'pending' or 'failed'
  // (with the latest caption from state), then calls the diary submit endpoint.
  // Uploaded photos are skipped on retry — only outstanding ones run again.
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error('planId not loaded')
      const outstanding = photosRef.current.filter(
        (p) => p.status === 'pending' || p.status === 'failed',
      )
      if (outstanding.length > 0) {
        const results = await Promise.allSettled(
          outstanding.map((p) => uploadEntry(p.localId, planId)),
        )
        const anyFailed = results.some((r) => r.status === 'rejected')
        if (anyFailed) {
          // Don't call submit — let the user retry / remove failed photos.
          throw new Error('upload-failed')
        }
      }
      return submitDiaryRequest(requestId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-questionnaires'] })
      queryClient.invalidateQueries({ queryKey: ['active-diary-requests'] })
      Toast.show(t('diary.bulk.successToast'))
      // Use router.back() instead of replace so the screen slides out using the
      // stack's back animation — replace would just swap the screen with no
      // transition, making the dismissal feel abrupt.
      router.back()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      Toast.show(t(msg === 'upload-failed' ? 'diary.bulk.errorUpload' : 'diary.bulk.errorSubmit'))
    },
  })

  const isSubmitting = submitMutation.isPending
  const submitDisabled = !canSubmit || isSubmitting

  // ── Layout constants ──────────────────────────────────────────────────────────
  const MARGIN = 20
  const GAP = 10
  const tileWidth = (width - MARGIN * 2 - GAP) / 2

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Header: classic back button + title ─────────────────────────────── */}
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
          {totalCount > 0
            ? t('diary.bulk.title', { count: uploadedCount, total: totalCount })
            : t('diary.bulk.titleEmpty')}
        </Text>

        {/* Right spacer keeps title centred. */}
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Pinned add-photos card (always visible) ─────────────────────────── */}
      <View style={styles.pinnedAddArea}>
        {requestFailed ? (
          // Hard fetch failure (network / server), or `requestId` never
          // arrived as a route param — surfaced with a retry instead of
          // leaving the card spinning forever (#782). Refetching a query
          // with no `requestId` is a no-op, so the retry action is only
          // offered when there's an actual query to retry.
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
          // instead of disabling the button forever with no explanation (#782).
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

      {/* ── Scrollable photo grid only ──────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {photos.length > 0 && (
          <View style={styles.grid}>
            {photos.map((entry, idx) => (
              <PhotoTile
                key={entry.localId}
                entry={entry}
                tileWidth={tileWidth}
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
      </ScrollView>

      {/* ── Pinned action bar ────────────────────────────────────────────────── */}
      <View
        style={[
          styles.actionBar,
          { backgroundColor: colors.bg, borderTopColor: colors.sep2 },
        ]}
      >
        {/* Submit CTA */}
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
          {isSubmitting ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[Type.subheadline, styles.ctaLabel, { color: colors.onAccent }]}>
              {t('diary.bulk.submitCta')}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── PhotoTile ───────────────────────────────────────────────────────────────

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
        styles.tile,
        {
          width: tileWidth,
          backgroundColor: colors.bg2,
          borderColor: entry.status === 'failed' ? colors.red : colors.sep2,
        },
      ]}
    >
      {/* Thumbnail */}
      <View style={[styles.thumbContainer, { height: THUMB_HEIGHT }]}>
        <Image
          source={{ uri: entry.localUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${t('diary.bulk.removePhoto')} ${index + 1}`}
        />

        {/* Status badge (top-right) — hidden when 'pending' */}
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

        {/* Remove button (top-left) */}
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

      {/* Caption text input — below the thumbnail */}
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

      {/* Retry button — shown only when failed */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Top bar
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
    width: 92,
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
    width: 92,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 130,
  },

  // Pinned add-photos area (sits between header and scrollable grid)
  pinnedAddArea: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },

  // Add-photos dashed card
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

  // Error / no-plan state card (replaces the infinite spinner, #782)
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

  // 2-column grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  // Individual tile
  tile: {
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

  // Action bar
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

export default DiaryBulkScreen
