/**
 * Plan Photos screen — day-level photo gallery for the nutrition plan.
 *
 * Prototype reference: docs/prototypes/mobile/scenes/plan-photos.html
 *
 * Layout:
 *   1. Modal header: "Fotky z plánu" title, eyebrow subtitle, close button.
 *   2. Category filter chips: Food / Progress / Free with per-category counts.
 *   3. 3-column square photo grid (gap 4). Tap → ImageLightbox.
 *   4. Empty state when no photos in the filtered set.
 *   5. Floating action button (gold circle, bottom-right). Tap → multi-photo
 *      picker. Uploads, then saves via saveDayPhotos (REPLACE semantics with
 *      all existing + new photos; new uploads default to Free category).
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { useImagePicker } from '@/hooks/useImagePicker'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import {
  getTodayDayLog,
  generateDayPhotoUploadUrl,
  saveDayPhotos,
  DayPhotoCategory,
  type GetTodayDayLogResponse,
  type DayPhotoInput,
} from '@/api/nutrition'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import { Toast } from '@/lib/toast'

// ─── Types ───────────────────────────────────────────────────────────────────

type PhotoCategory = 'Food' | 'Progress' | 'Free'
type FilterCategory = 'All' | PhotoCategory

interface PhotoItem {
  blobUrl: string
  note?: string | null
  category: PhotoCategory
  uploadedAt?: string
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PlanPhotosScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()

  // ── Active category filter ('All' shows everything) ──
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All')

  // ── Lightbox state ──
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ── Query: today's day log ──
  const dayLogQuery = useQuery<GetTodayDayLogResponse>({
    queryKey: ['day-log-today'],
    queryFn: getTodayDayLog,
    staleTime: 30_000,
  })

  // ── Derived photo list ──
  const allPhotos = useMemo((): PhotoItem[] => {
    return (dayLogQuery.data?.photos ?? [])
      .filter((p): p is typeof p & { blobUrl: string } => typeof p.blobUrl === 'string' && p.blobUrl.length > 0)
      .map((p) => ({
        blobUrl: p.blobUrl,
        note: p.note ?? null,
        category: (p.category as PhotoCategory | undefined) ?? 'Free',
        uploadedAt: p.uploadedAt,
      }))
  }, [dayLogQuery.data])

  const foodCount = useMemo(() => allPhotos.filter((p) => p.category === 'Food').length, [allPhotos])
  const progressCount = useMemo(() => allPhotos.filter((p) => p.category === 'Progress').length, [allPhotos])
  const freeCount = useMemo(() => allPhotos.filter((p) => p.category === 'Free').length, [allPhotos])

  const visiblePhotos = useMemo(
    () => (activeFilter === 'All' ? allPhotos : allPhotos.filter((p) => p.category === activeFilter)),
    [allPhotos, activeFilter],
  )

  // ── Lightbox images from visible set ──
  const lightboxImages = useMemo(() => visiblePhotos.map((p) => p.blobUrl), [visiblePhotos])
  const lightboxNotes = useMemo(() => visiblePhotos.map((p) => p.note ?? null), [visiblePhotos])

  // ── Save-photos mutation (REPLACE semantics) ──
  const saveMutation = useMutation({
    mutationFn: (newPhotos: DayPhotoInput[]) => {
      // Merge existing photos with new ones. Preserve existing metadata.
      const existingInputs: DayPhotoInput[] = allPhotos.map((p) => ({
        blobUrl: p.blobUrl,
        note: p.note ?? undefined,
        category: p.category as DayPhotoCategory,
      }))
      return saveDayPhotos({
        photos: [...existingInputs, ...newPhotos],
        note: dayLogQuery.data?.note ?? null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['day-log-today'] })
      Toast.show(t('mealLogPhoto.successToast'))
    },
  })

  // ── Multi-photo picker ──
  const { pick: pickGallery, uploading: galleryUploading } = useImagePicker(
    {
      source: 'library',
      allowsMultipleSelection: true,
      requestUploadUrl: async ({ contentType, sizeBytes }) => {
        return generateDayPhotoUploadUrl(contentType, sizeBytes)
      },
    },
    undefined,
    (blobUrls) => {
      const newInputs: DayPhotoInput[] = blobUrls.map((url) => ({
        blobUrl: url,
        note: undefined,
        category: DayPhotoCategory.Free,
      }))
      saveMutation.mutate(newInputs)
    },
  )

  const isUploading = galleryUploading || saveMutation.isPending

  const handleFabPress = useCallback(() => {
    pickGallery()
  }, [pickGallery])

  const handleTilePress = useCallback(
    (index: number) => {
      setLightboxIndex(index)
      setLightboxVisible(true)
    },
    [],
  )

  const handleLightboxClose = useCallback(() => {
    setLightboxVisible(false)
  }, [])

  // ── Tile size: 3 columns, gap 4, outer margin 20 each side ──
  const MARGIN = 20
  const GAP = 4
  const tileSize = (width - MARGIN * 2 - GAP * 2) / 3

  // ── Grid item renderer ──
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PhotoItem>) => (
      <Pressable
        onPress={() => handleTilePress(index)}
        accessibilityRole="button"
        accessibilityLabel={`${t('planPhotos.categoryFood')} ${index + 1}`}
        style={[
          styles.tile,
          {
            width: tileSize,
            height: tileSize,
            backgroundColor: colors.fill2,
          },
        ]}
      >
        <Image
          source={{ uri: item.blobUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Pressable>
    ),
    [handleTilePress, tileSize, colors.fill2, t],
  )

  const keyExtractor = useCallback(
    (item: PhotoItem, index: number) => `${item.blobUrl}-${index}`,
    [],
  )

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom']}
    >
      {/* ── Modal header ── */}
      <View style={[styles.header, { borderBottomColor: colors.sep2 }]}>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.label }]} numberOfLines={1}>
            {t('planPhotos.title')}
          </Text>
          <Text style={[styles.headerSub, { color: colors.label2 }]} numberOfLines={1}>
            {t('planPhotos.totalCount', { count: allPhotos.length })}
          </Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('imageLightbox.close')}
          style={[styles.closeBtn, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="close" size={18} color={colors.label2} />
        </Pressable>
      </View>

      {/* ── Category filter chips ── */}
      <View style={styles.chipsRow}>
        {(
          [
            { key: 'All', label: t('planPhotos.categoryAll'), count: allPhotos.length },
            { key: 'Food', label: t('planPhotos.categoryFood'), count: foodCount },
            { key: 'Progress', label: t('planPhotos.categoryProgress'), count: progressCount },
            { key: 'Free', label: t('planPhotos.categoryFree'), count: freeCount },
          ] as { key: FilterCategory; label: string; count: number }[]
        ).map(({ key, label, count }) => {
          const isActive = activeFilter === key
          return (
            <Pressable
              key={key}
              onPress={() => setActiveFilter(key)}
              hitSlop={6}
              accessibilityRole="button"
              style={[
                styles.chip,
                isActive
                  ? { backgroundColor: colors.goldBg, borderColor: colors.gold, borderWidth: 1.5 }
                  : { backgroundColor: colors.bg2, borderColor: colors.sep2, borderWidth: 1 },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: isActive ? colors.gold : colors.label },
                  isActive && styles.chipLabelActive,
                ]}
              >
                {label} ({count})
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Photo grid ── */}
      {dayLogQuery.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : visiblePhotos.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={44} color={colors.label3} />
          <Text style={[styles.emptyLabel, { color: colors.label2 }]}>
            {t('planPhotos.empty')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visiblePhotos}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={3}
          contentContainerStyle={[styles.grid, { paddingHorizontal: MARGIN }]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Floating action button ── */}
      <Pressable
        onPress={handleFabPress}
        disabled={isUploading}
        accessibilityRole="button"
        accessibilityLabel={t('planPhotos.addPhotoA11y')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.gold, opacity: pressed || isUploading ? 0.6 : 1 },
        ]}
      >
        {isUploading ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Ionicons name="add" size={28} color={colors.onAccent} />
        )}
      </Pressable>

      {/* ── ImageLightbox ── */}
      <ImageLightbox
        visible={lightboxVisible}
        images={lightboxImages}
        startIndex={lightboxIndex}
        onClose={handleLightboxClose}
        imageNotes={lightboxNotes}
      />
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { ...Type.title3 },
  headerSub: { ...Type.caption1, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    flexShrink: 0,
  },

  // Category chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 99,
  },
  chipLabel: {
    ...Type.footnote,
    fontWeight: '500',
  },
  chipLabelActive: {
    fontWeight: '600',
  },

  // Grid
  grid: {
    paddingTop: 4,
    paddingBottom: 100,
    gap: 4,
  },
  row: {
    gap: 4,
  },
  tile: {
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },

  // Empty / loading state
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyLabel: {
    ...Type.subheadline,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c9a84c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
})
