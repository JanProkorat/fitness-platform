/**
 * Plan Photos — upload screen.
 *
 * Reached from the gold `+` FAB on the plan-photos gallery. Replaces the
 * previous "tap-to-open-gallery" shortcut so the client can:
 *  1. Pick photos from camera OR library (source sheet, no auto-default).
 *  2. Choose a category for the batch (Food / Progress / Free).
 *  3. Type a caption per photo before submitting.
 *  4. Submit — uploads run in parallel with per-tile status badges,
 *     captions land on the backend with the photo, and the screen
 *     dismisses back to the gallery on success.
 *
 * Models the diary `bulk.tsx` upload flow but without the diary-request
 * coupling — finalizes plain `PlanPhoto` records scoped to `planId`.
 */

import { useCallback, useReducer, useRef, useState } from 'react'
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
import {
  generatePlanPhotoUploadUrl,
  finalizePlanPhoto,
  PlanPhotoCategory,
} from '@/api/planPhotos'
import { Toast } from '@/lib/toast'
import { transcodeHeicToJpeg } from '@/lib/heicTranscode'

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
    default:
      return state
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// UI categories mirror the gallery filter chips (Food / Progress / Free).
type UiCategory = 'Food' | 'Progress' | 'Free'

const UI_TO_WIRE: Record<UiCategory, PlanPhotoCategory> = {
  Food: PlanPhotoCategory.Food,
  Progress: PlanPhotoCategory.Body,
  Free: PlanPhotoCategory.FreeForm,
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PlanPhotosUploadScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()

  const { planId, planType } = useLocalSearchParams<{ planId: string; planType?: string }>()
  // On training plans, Food is not a valid upload category. Default stays Free.
  const isTrainingPlan = planType === 'training'

  const [photos, dispatch] = useReducer(photosReducer, [])
  const [picking, setPicking] = useState(false)
  const [category, setCategory] = useState<UiCategory>('Free')

  const photosRef = useRef(photos)
  photosRef.current = photos

  const uploadingCount = photos.filter((p) => p.status === 'uploading').length
  const totalCount = photos.length

  const canSubmit = totalCount > 0 && uploadingCount === 0

  // ── Source-selection sheet ──
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
      const entry = photosRef.current.find((p) => p.localId === localId)
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

        const latest = photosRef.current.find((p) => p.localId === localId)
        const caption = latest?.caption?.trim() || undefined

        await finalizePlanPhoto(effectivePlanId, {
          blobUrl,
          category: UI_TO_WIRE[category],
          description: caption,
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
    [category],
  )

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error('planId not loaded')
      const outstanding = photosRef.current.filter(
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
      // Fire-and-forget invalidate. Awaiting here would freeze the spinner;
      // the gallery's own `refetchOnMount` semantics pick the photos back up.
      queryClient.invalidateQueries({ queryKey: ['plan-photos', planId] })
      Toast.show(t('planPhotosUpload.successToast'))
      router.back()
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : ''
      Toast.show(t(msg === 'upload-failed' ? 'planPhotosUpload.errorUpload' : 'planPhotosUpload.errorSubmit'))
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

  const isSubmitting = submitMutation.isPending
  const submitDisabled = !canSubmit || isSubmitting

  const MARGIN = 20
  const GAP = 10
  const tileWidth = (width - MARGIN * 2 - GAP) / 2

  // On training plans, Food is omitted from the selector — it is a nutrition-only
  // category. The default category 'Free' is always available on both plan types.
  const categoryChips: { key: UiCategory; label: string }[] = [
    ...(!isTrainingPlan ? [{ key: 'Food' as UiCategory, label: t('planPhotos.categoryFood') }] : []),
    { key: 'Progress', label: t('planPhotos.categoryProgress') },
    { key: 'Free', label: t('planPhotos.categoryFree') },
  ]

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Header — gold chevron back ── */}
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
          {t('planPhotosUpload.title')}
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* ── Pinned picker card ── */}
      <View style={styles.pickerArea}>
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
                {t('planPhotosUpload.hint')}
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
      </View>

      {/* ── Pinned category selector ── */}
      <View style={[styles.chipsRow, { borderBottomColor: colors.sep2 }]}>
        {categoryChips.map(({ key, label }) => {
          const isActive = category === key
          return (
            <Pressable
              key={key}
              onPress={() => setCategory(key)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: colors.goldBg, borderColor: colors.gold, borderWidth: 1.5 }
                  : { backgroundColor: colors.bg2, borderColor: colors.sep2, borderWidth: 1 },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.chipLabel,
                  { color: isActive ? colors.gold : colors.label },
                  isActive && styles.chipLabelActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Staged photos grid ── */}
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

      {/* ── Pinned bottom action bar ── */}
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
          {isSubmitting ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[Type.subheadline, styles.ctaLabel, { color: colors.onAccent }]}>
              {t('planPhotosUpload.submitCta')}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

// ─── PhotoTile (mirrors diary/bulk.tsx) ──────────────────────────────────────

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

const HEADER_SIDE_WIDTH = 92
const EMOJI_LARGE = 32

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header — same as the diary wizard
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
    flexShrink: 0,
  },

  // Pinned picker card
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

  // Category chip row
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
  },
  chipLabelActive: {
    fontWeight: '600',
  },

  // Scrollable grid
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 130,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  // Tile (matches diary/bulk.tsx)
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
