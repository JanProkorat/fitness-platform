/**
 * Session Log Photo screen — modal presented from the Today training card.
 *
 * Mirrors meal-log-photo.tsx (nutrition) but scoped to a training session:
 *   1. Minimal modal header (safe-area padding only)
 *   2. Session header card: name · session info
 *   3. Photo picker:
 *        - When 0 photos: dashed drop zone (tap = gallery multi-select,
 *          long-press = camera single-shot)
 *        - When ≥ 1: vertical list of photo rows with inline caption inputs + "add more" tile
 *   4. Note textarea (500-char counter)
 *   5. Info strip: visible-to-coach message
 *   6. Action bar (pinned): primary CTA only (full-width), dismiss via swipe-down
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useImagePicker } from '@/hooks/useImagePicker'
import { useAuthStore } from '@/stores/auth'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import {
  saveSessionPhotos,
  generateSessionPhotoUploadUrl,
  type SessionPhotoInput,
  type TodayTrainingResponse,
} from '@/api/training'
import { Toast } from '@/lib/toast'

const NOTE_MAX_CHARS = 500

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function SessionLogPhotoScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const queryClient = useQueryClient()

  // ── Route params ──
  const params = useLocalSearchParams<{
    sessionId: string
    sessionName: string
  }>()

  const sessionId = params.sessionId ?? ''
  const sessionName = params.sessionName ?? ''

  // ── Coach name from auth store ──
  const coach = useAuthStore((s) => s.coach)
  const coachName = coach?.name ?? null

  // ── Pre-load existing photos + note from the today-training cache ──
  const existingPhotos = useMemo(() => {
    const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
    const photos = (cache?.photosBySession ?? {})[sessionId] ?? []
    return photos
      .filter((p) => typeof p.blobUrl === 'string' && p.blobUrl.length > 0)
      .map((p) => ({ blobUrl: p.blobUrl, note: p.note ?? null }))
  }, [queryClient, sessionId])

  const existingNote = useMemo(() => {
    const cache = queryClient.getQueryData<TodayTrainingResponse>(['today-training'])
    return (cache?.notesBySession ?? {})[sessionId] ?? ''
  }, [queryClient, sessionId])

  // ── Local state (seeded from cache on mount) ──
  const [note, setNote] = useState<string>(() => existingNote)
  const [uploadedPhotos, setUploadedPhotos] = useState<SessionPhotoInput[]>(
    () => existingPhotos,
  )

  // ── Multi-photo picker (gallery) ──
  const { pick: pickGallery, uploading: galleryUploading } = useImagePicker(
    {
      source: 'library',
      allowsMultipleSelection: true,
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        return generateSessionPhotoUploadUrl(sessionId, contentType, sizeBytes)
      },
    },
    undefined,
    (blobUrls) => {
      setUploadedPhotos((prev) => [
        ...prev,
        ...blobUrls.map((url) => ({ blobUrl: url, note: null })),
      ])
    },
  )

  // ── Single-shot camera picker ──
  const { pick: pickCamera, uploading: cameraUploading } = useImagePicker(
    {
      source: 'camera',
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        return generateSessionPhotoUploadUrl(sessionId, contentType, sizeBytes)
      },
    },
    (blobUrl) => {
      setUploadedPhotos((prev) => [...prev, { blobUrl, note: null }])
    },
  )

  const imageUploading = galleryUploading || cameraUploading

  const handleDropZoneTap = useCallback(() => {
    pickGallery()
  }, [pickGallery])

  const handleDropZoneLongPress = useCallback(() => {
    pickCamera()
  }, [pickCamera])

  const handleAddMore = useCallback(() => {
    pickGallery()
  }, [pickGallery])

  const handleRemovePhoto = useCallback((blobUrl: string) => {
    setUploadedPhotos((prev) => prev.filter((p) => p.blobUrl !== blobUrl))
  }, [])

  const handlePhotoNoteChange = useCallback((blobUrl: string, noteText: string) => {
    setUploadedPhotos((prev) =>
      prev.map((p) =>
        p.blobUrl === blobUrl ? { ...p, note: noteText.slice(0, NOTE_MAX_CHARS) || null } : p,
      ),
    )
  }, [])

  // ── Save-photos mutation — REPLACE semantics ──
  const saveMutation = useMutation({
    mutationFn: () =>
      saveSessionPhotos(sessionId, {
        photos: uploadedPhotos,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      // Invalidate the today-training query so photosBySession refreshes.
      // This mirrors how meal-log-photo invalidates today-log after saveMealPhotos.
      queryClient.invalidateQueries({ queryKey: ['today-training'] })
      Toast.show(t('sessionLogPhoto.successToast'))
      router.back()
    },
  })

  const hasContent = uploadedPhotos.length > 0 || note.trim().length > 0
  const isSubmitting = saveMutation.isPending
  const isLoading = isSubmitting || imageUploading

  const handleSubmit = useCallback(() => {
    if (isLoading || !hasContent) return
    saveMutation.mutate()
  }, [saveMutation, isLoading, hasContent])

  // ── Info strip text ──
  const infoText = coachName
    ? t('sessionLogPhoto.infoStrip', { coachName })
    : t('sessionLogPhoto.infoStripNoCoach')

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Minimal header ── */}
        <View style={[styles.header, { borderBottomColor: colors.sep2 }]} />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Session header card ── */}
          <View style={[styles.sessionCard, { backgroundColor: colors.bg2 }]}>
            <View style={[styles.sessionDot, { backgroundColor: colors.gold }]} />
            <View style={styles.sessionCardInfo}>
              <Text style={[styles.sessionCardName, { color: colors.label }]} numberOfLines={1}>
                {sessionName}
              </Text>
            </View>
          </View>

          {/* ── Photo picker ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.label2 }]}>
              {t('sessionLogPhoto.photoSectionLabel').toUpperCase()}
            </Text>

            {uploadedPhotos.length === 0 ? (
              /* ── Empty state: dashed drop zone ── */
              <Pressable
                onPress={handleDropZoneTap}
                onLongPress={handleDropZoneLongPress}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={t('sessionLogPhoto.photoPickerHint')}
                style={[
                  styles.photoDropZone,
                  {
                    backgroundColor: colors.bg2,
                    borderColor: colors.sep,
                  },
                ]}
              >
                {imageUploading ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <>
                    <Ionicons
                      name="camera-outline"
                      size={36}
                      color={colors.label3}
                      style={styles.dropZoneIcon}
                    />
                    <Text style={[styles.dropZoneHint, { color: colors.label2 }]}>
                      {t('sessionLogPhoto.photoPickerHint')}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              /* ── Filled state: photo rows (thumbnail + inline caption) ── */
              <View style={styles.photoRows}>
                {uploadedPhotos.map((photo) => (
                  <View
                    key={photo.blobUrl}
                    style={[styles.photoRow, { backgroundColor: colors.bg2, borderColor: colors.sep2 }]}
                  >
                    {/* Thumbnail */}
                    <View style={[styles.thumbWrap, { backgroundColor: colors.fill2 }]}>
                      <Image
                        source={{ uri: photo.blobUrl }}
                        style={styles.thumbImg}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => handleRemovePhoto(photo.blobUrl)}
                        style={[styles.thumbRemoveBtn, { backgroundColor: colors.bg2 }]}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t('sessionLogPhoto.removePhoto')}
                      >
                        <Ionicons name="close" size={12} color={colors.label2} />
                      </Pressable>
                    </View>
                    {/* Per-photo caption input */}
                    <TextInput
                      value={photo.note ?? ''}
                      onChangeText={(text) => handlePhotoNoteChange(photo.blobUrl, text)}
                      placeholder={t('sessionLogPhoto.photoCaption.placeholder')}
                      placeholderTextColor={colors.label3}
                      maxLength={NOTE_MAX_CHARS}
                      style={[
                        styles.captionInput,
                        {
                          color: colors.label,
                          backgroundColor: colors.bg,
                          borderColor: colors.sep2,
                        },
                      ]}
                      accessibilityLabel={t('sessionLogPhoto.photoCaption.a11y')}
                    />
                  </View>
                ))}

                {/* "Add more" tile */}
                <Pressable
                  onPress={handleAddMore}
                  accessibilityRole="button"
                  accessibilityLabel={t('sessionLogPhoto.addMorePhotos')}
                  style={[
                    styles.addMoreRow,
                    {
                      backgroundColor: colors.bg2,
                      borderColor: colors.sep,
                    },
                  ]}
                >
                  {imageUploading ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <>
                      <Ionicons name="add" size={22} color={colors.label3} />
                      <Text style={[styles.addMoreLabel, { color: colors.label3 }]}>
                        {t('sessionLogPhoto.addMorePhotos')}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Note textarea ── */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, { color: colors.label2 }]}>
                {t('sessionLogPhoto.noteSectionLabel').toUpperCase()}
              </Text>
              <Text style={[styles.noteCounter, { color: colors.label3 }]}>
                {t('sessionLogPhoto.noteCounter', {
                  current: note.length,
                  max: NOTE_MAX_CHARS,
                })}
              </Text>
            </View>
            <TextInput
              value={note}
              onChangeText={(text) => setNote(text.slice(0, NOTE_MAX_CHARS))}
              placeholder={t('sessionLogPhoto.notePlaceholder')}
              placeholderTextColor={colors.label3}
              multiline
              maxLength={NOTE_MAX_CHARS}
              style={[
                styles.noteInput,
                {
                  color: colors.label,
                  backgroundColor: colors.bg2,
                  borderColor: colors.sep2,
                },
              ]}
              textAlignVertical="top"
              accessibilityLabel={t('sessionLogPhoto.noteSectionLabel')}
            />
          </View>

          {/* ── Info strip ── */}
          <View
            style={[
              styles.infoStrip,
              {
                backgroundColor: colors.bg2,
                borderColor: colors.sep2,
              },
            ]}
          >
            <Text style={[styles.infoText, { color: colors.label2 }]}>
              {infoText}
            </Text>
          </View>

          {/* Bottom padding so the action bar doesn't cover content */}
          <View style={{ height: 8 }} />
        </ScrollView>

        {/* ── Action bar (single full-width primary CTA) ── */}
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
            disabled={isLoading || !hasContent}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryBtn,
              {
                backgroundColor: colors.gold,
                opacity: pressed || isLoading || !hasContent ? 0.5 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>
                {t('sessionLogPhoto.savePhoto')}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const GRID_MARGIN = 20

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Header — minimal, just provides the hairline separator below safe-area top
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Session header card
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: GRID_MARGIN,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.lg,
  },
  sessionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  sessionCardInfo: { flex: 1, minWidth: 0 },
  sessionCardName: { ...Type.callout, fontWeight: '600' },

  // Section (photo + note)
  section: { marginHorizontal: GRID_MARGIN, marginTop: 20 },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    ...Type.footnote,
    fontWeight: '600',
    letterSpacing: 0.05,
    marginBottom: 10,
  },

  // Photo drop zone (empty state)
  photoDropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 28,
  },
  dropZoneIcon: { marginBottom: 6 },
  dropZoneHint: { ...Type.footnote },

  // Photo rows (filled state) — vertical list, thumbnail + caption side-by-side
  photoRows: {
    gap: 10,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: 10,
  },
  thumbWrap: {
    width: 80,
    height: 80,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  thumbImg: {
    width: 80,
    height: 80,
  },
  thumbRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  captionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    ...Type.footnote,
    lineHeight: 18,
  },

  // "Add more" row (dashed, below photo rows)
  addMoreRow: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addMoreLabel: {
    ...Type.caption1,
  },

  // Note textarea
  noteCounter: { ...Type.caption1, marginBottom: 10 },
  noteInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 80,
    ...Type.subheadline,
    lineHeight: 22,
  },

  // Info strip — neutral tinted border box
  infoStrip: {
    marginHorizontal: GRID_MARGIN,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoText: { ...Type.footnote, lineHeight: 19 },

  // Action bar — single full-width primary CTA
  actionBar: {
    paddingHorizontal: GRID_MARGIN,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...Type.callout, fontWeight: '600' },
})
