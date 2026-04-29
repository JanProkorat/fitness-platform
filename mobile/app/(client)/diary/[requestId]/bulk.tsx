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
 *     diary-requests + today-questionnaires queries, navigate to Today.
 */

import React, { useCallback, useReducer, useState } from 'react'
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
import { goldAlpha } from '@/constants/colors'
import { generatePlanPhotoUploadUrl, finalizePlanPhoto } from '@/api/planPhotos'
import { submitDiaryRequest } from '@/api/diaryRequests'
import { Toast } from '@/lib/toast'
import { href } from '@/lib/navigation'

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

  const { requestId, planId, professionalName } = useLocalSearchParams<{
    requestId: string
    planId: string
    professionalName?: string
  }>()

  // ── Photo list managed by a local reducer ────────────────────────────────────
  const [photos, dispatch] = useReducer(photosReducer, [])
  const [picking, setPicking] = useState(false)

  const uploadingCount = photos.filter((p) => p.status === 'uploading').length
  const failedCount = photos.filter((p) => p.status === 'failed').length
  const uploadedCount = photos.filter((p) => p.status === 'uploaded').length
  const totalCount = photos.length

  // Submit enabled when ≥1 photo, none uploading, no failures (AC #2).
  const canSubmit = totalCount > 0 && uploadingCount === 0 && failedCount === 0

  // ── Upload a single entry ────────────────────────────────────────────────────
  const uploadEntry = useCallback(
    async (entry: PhotoEntry, effectivePlanId: string): Promise<void> => {
      dispatch({ type: 'SET_STATUS', localId: entry.localId, status: 'uploading' })
      try {
        const contentType = getMimeType(entry.localUri)

        // 1. Request presigned PUT URL.
        const { uploadUrl, blobUrl } = await generatePlanPhotoUploadUrl(
          effectivePlanId,
          contentType,
          0, // size unknown here; server enforces its own cap
        )

        // 2. PUT the raw binary to the signed URL.
        const fileResponse = await fetch(entry.localUri)
        const blob = await fileResponse.blob()
        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: blob,
        })
        if (!putResponse.ok) {
          throw new Error(`PUT ${putResponse.status} ${putResponse.statusText}`)
        }

        // 3. Finalize — links the photo to this diary request.
        //    The server transitions Accepted → InProgress on the first call.
        await finalizePlanPhoto(effectivePlanId, {
          blobUrl,
          description: entry.caption || undefined,
          diaryRequestId: requestId,
        })

        dispatch({
          type: 'SET_STATUS',
          localId: entry.localId,
          status: 'uploaded',
          remoteUrl: blobUrl,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        dispatch({
          type: 'SET_STATUS',
          localId: entry.localId,
          status: 'failed',
          errorMsg: msg,
        })
        Toast.show(t('diary.bulk.errorUpload'))
      }
    },
    [requestId, t],
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

  // ── Pick photos and start uploads ─────────────────────────────────────────────
  const handlePickAndUpload = useCallback(async () => {
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

      const newEntries: PhotoEntry[] = result.assets.map((asset) => ({
        localId: nextLocalId(),
        localUri: asset.uri,
        caption: '',
        status: 'pending' as PhotoStatus,
      }))

      dispatch({ type: 'ADD_PHOTOS', entries: newEntries })

      // Start uploads in parallel. Each upload updates its own entry status;
      // failures keep the entry (with caption) in the list for retry (AC #1).
      await Promise.all(newEntries.map((entry) => uploadEntry(entry, planId)))
    } finally {
      setPicking(false)
    }
  }, [picking, planId, selectSource, ensureLibraryPermission, ensureCameraPermission, uploadEntry, t])

  // ── Retry a failed entry ─────────────────────────────────────────────────────
  const handleRetry = useCallback(
    (entry: PhotoEntry) => {
      if (!planId) return
      void uploadEntry(entry, planId)
    },
    [planId, uploadEntry],
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
  const submitMutation = useMutation({
    mutationFn: () => submitDiaryRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diary-requests'] })
      queryClient.invalidateQueries({ queryKey: ['today-questionnaires'] })
      Toast.show(t('diary.bulk.successToast'))
      router.replace(href('/(client)'))
    },
    onError: () => {
      Toast.show(t('diary.bulk.errorSubmit'))
    },
  })

  const isSubmitting = submitMutation.isPending
  const submitDisabled = !canSubmit || isSubmitting
  const displayName = professionalName ?? ''

  // ── Layout constants ──────────────────────────────────────────────────────────
  const MARGIN = 20
  const GAP = 10
  const tileWidth = (width - MARGIN * 2 - GAP) / 2

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Modal-style top bar ──────────────────────────────────────────── */}
      <View style={[styles.topBar, { borderBottomColor: colors.sep2 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.topBarSide, { opacity: pressed ? 0.5 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('diary.bulk.close')}
        >
          <Text style={[Type.subheadline, styles.topBarAction, { color: colors.label2 }]}>
            {t('diary.bulk.close')}
          </Text>
        </Pressable>

        <Text
          style={[Type.subheadline, styles.topBarTitle, { color: colors.label }]}
          numberOfLines={1}
        >
          {t('diary.bulk.title', { count: uploadedCount, total: totalCount })}
        </Text>

        {/* Right spacer keeps title centred. */}
        <View style={styles.topBarSide} />
      </View>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hint strip */}
        <View
          style={[
            styles.hintStrip,
            { backgroundColor: goldAlpha['08'], borderColor: colors.gold },
          ]}
        >
          <Text style={[Type.footnote, styles.hintText, { color: colors.label2 }]}>
            {t('diary.bulk.hint')}
          </Text>
        </View>

        {/* Add-photos dashed card */}
        <Pressable
          onPress={handlePickAndUpload}
          disabled={picking}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.addCard,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep,
              opacity: picking || pressed ? 0.7 : 1,
            },
          ]}
        >
          {picking ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <>
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

        {/* 2-column thumbnail grid */}
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

        {/* Totals strip */}
        {photos.length > 0 && (
          <View style={[styles.totalsStrip, { backgroundColor: colors.fill }]}>
            <Text style={[Type.footnote, styles.totalsText, { color: colors.label2 }]}>
              {totalCount}{' '}
              {t(`diary.bulk.photo`, { count: totalCount })}
            </Text>
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
              {t('diary.bulk.submitCta', { name: displayName || t('common.yourCoach') })}
            </Text>
          )}
        </Pressable>

        {/* Cancel */}
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.ctaCancel,
            {
              backgroundColor: colors.bg2,
              borderColor: colors.sep2,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
        >
          <Text style={[Type.footnote, styles.ctaCancelLabel, { color: colors.label }]}>
            {t('diary.bulk.cancelCta')}
          </Text>
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
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.statusBadgeText}>
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
          style={styles.removeBtn}
        >
          <Ionicons name="close" size={14} color="#ffffff" />
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
          <Text style={[Type.caption1, styles.retryBtnLabel]}>
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
  topBarAction: {
    fontWeight: '600',
  },
  topBarTitle: {
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 130,
    gap: 14,
  },

  // Hint strip
  hintStrip: {
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  hintText: {
    lineHeight: 18,
  },

  // Add-photos dashed card
  addCard: {
    padding: 28,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addCardIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  addCardTitle: {
    fontWeight: '600',
  },
  addCardHint: {
    textAlign: 'center',
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
    color: '#ffffff',
    fontWeight: '600',
  },
  removeBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
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
    color: '#ffffff',
    fontWeight: '600',
  },

  // Totals strip
  totalsStrip: {
    borderRadius: Radius.md,
    padding: 10,
    alignItems: 'center',
  },
  totalsText: {
    fontWeight: '600',
  },

  // Action bar
  actionBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    flexDirection: 'row',
    gap: 10,
  },
  ctaSubmit: {
    flex: 1,
    height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
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
    fontWeight: '600',
  },
})

export default DiaryBulkScreen
