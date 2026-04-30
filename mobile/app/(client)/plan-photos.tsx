/**
 * Plan Photos screen — gallery of PlanPhoto records for a nutrition/training plan.
 *
 * Prototype reference: docs/prototypes/mobile/scenes/plan-photos.html
 *
 * Layout:
 *   1. Modal header: "Fotky z plánu" title, total-count eyebrow, close button.
 *   2. Category filter chips: Food / Progress / Free (UI labels) — map to
 *      PlanPhotoCategory enum values Food / Body / FreeForm on the wire.
 *   3. 3-column square photo grid (gap 4). Tap → ImageLightbox.
 *   4. Empty state when no photos in the filtered set.
 *   5. Floating action button (gold circle, bottom-right). Tap → opens the
 *      dedicated `plan-photos-upload` screen where the client picks source
 *      (camera / library), sets the category for the batch, and types a
 *      caption per photo before submitting.
 *   6. SignalR `planphotouploaded` event invalidates the photos query.
 *
 * Route params:
 *   planId — the plan's public identifier (NutritionPlan/TrainingPlan ExternalId).
 *            Passed by plans/[planId].tsx when opening the modal.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { hrefParams } from '@/lib/navigation'
import {
  getPlanPhotos,
  PlanPhotoCategory,
  type PlanPhotoResponse,
} from '@/api/planPhotos'
import { onEvent } from '@/api/signalr'
import { ImageLightbox } from '@/components/ui/ImageLightbox'

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * UI-level filter category. Labels shown in the chips are the UI names;
 * they map to PlanPhotoCategory enum values on the wire:
 *   Food     → PlanPhotoCategory.Food
 *   Progress → PlanPhotoCategory.Body
 *   Free     → PlanPhotoCategory.FreeForm
 */
type UiCategory = 'Food' | 'Progress' | 'Free'
type FilterCategory = 'All' | UiCategory

/** Map from PlanPhotoCategory wire value back to UI category for display. */
const WIRE_TO_UI: Record<PlanPhotoCategory, UiCategory> = {
  [PlanPhotoCategory.Food]: 'Food',
  [PlanPhotoCategory.Body]: 'Progress',
  [PlanPhotoCategory.FreeForm]: 'Free',
}

interface PhotoItem {
  id: string
  blobUrl: string
  description?: string | null
  uiCategory: UiCategory
  takenAt?: string
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function PlanPhotosScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const queryClient = useQueryClient()
  const { width } = useWindowDimensions()

  // planId is required — passed by plans/[planId].tsx via hrefParams.
  const { planId } = useLocalSearchParams<{ planId: string }>()

  // ── Active category filter ('All' shows everything) ──
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All')

  // ── Lightbox state ──
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ── Query: plan photos (all pages — fetches page 1 with large pageSize) ──
  const photosQuery = useQuery<PlanPhotoResponse[]>({
    queryKey: ['plan-photos', planId],
    queryFn: () => getPlanPhotos(planId ?? '', 1, 100),
    enabled: !!planId,
    staleTime: 30_000,
  })

  // ── SignalR: invalidate when a new photo is uploaded ──
  useEffect(() => {
    const off = onEvent('planphotouploaded', (payload: unknown) => {
      // Invalidate the photos query for this plan (or all plan-photos queries
      // if the payload doesn't carry the planId we need).
      const data = payload as { planId?: string } | null
      if (!data?.planId || data.planId === planId) {
        queryClient.invalidateQueries({ queryKey: ['plan-photos', planId] })
      }
    })
    return off
  }, [planId, queryClient])

  // ── Derived photo list ──
  const allPhotos = useMemo((): PhotoItem[] => {
    return (photosQuery.data ?? [])
      .filter(
        (p): p is PlanPhotoResponse & { blobUrl: string; id: string } =>
          typeof p.blobUrl === 'string' && p.blobUrl.length > 0 && typeof p.id === 'string',
      )
      .map((p) => ({
        id: p.id,
        blobUrl: p.blobUrl,
        description: p.description ?? null,
        uiCategory: p.category != null ? (WIRE_TO_UI[p.category] ?? 'Free') : 'Free',
        takenAt: p.takenAt,
      }))
  }, [photosQuery.data])

  const foodCount = useMemo(() => allPhotos.filter((p) => p.uiCategory === 'Food').length, [allPhotos])
  const progressCount = useMemo(() => allPhotos.filter((p) => p.uiCategory === 'Progress').length, [allPhotos])
  const freeCount = useMemo(() => allPhotos.filter((p) => p.uiCategory === 'Free').length, [allPhotos])

  const visiblePhotos = useMemo(
    () =>
      activeFilter === 'All'
        ? allPhotos
        : allPhotos.filter((p) => p.uiCategory === activeFilter),
    [allPhotos, activeFilter],
  )

  // ── Lightbox images from visible set ──
  const lightboxImages = useMemo(() => visiblePhotos.map((p) => p.blobUrl), [visiblePhotos])
  const lightboxNotes = useMemo(
    () => visiblePhotos.map((p) => p.description ?? null),
    [visiblePhotos],
  )

  // ── FAB → navigate to the dedicated upload screen ──
  // The screen owns the source-pick / category / per-photo caption flow.
  // Uploaded photos invalidate ['plan-photos', planId], which this gallery
  // listens for via the SignalR hook above plus its own staleTime.
  const handleFabPress = useCallback(() => {
    if (!planId) return
    router.push(hrefParams('/(client)/plan-photos-upload', { planId }))
  }, [planId, router])

  const handleTilePress = useCallback((index: number) => {
    setLightboxIndex(index)
    setLightboxVisible(true)
  }, [])

  const handleLightboxClose = useCallback(() => {
    setLightboxVisible(false)
  }, [])

  // ── Tile size: 3 columns, gap 4, outer margin 20 each side ──
  const MARGIN = 20
  const GAP = 4
  const tileSize = (width - MARGIN * 2 - GAP * 2) / 3

  // ── Grid item renderer ──
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<PhotoItem>) => {
      const labelKey =
        item.uiCategory === 'Food'
          ? 'planPhotos.categoryFood'
          : item.uiCategory === 'Progress'
            ? 'planPhotos.categoryProgress'
            : 'planPhotos.categoryFree'
      return (
      <Pressable
        onPress={() => handleTilePress(index)}
        accessibilityRole="button"
        accessibilityLabel={`${t(labelKey)} ${index + 1}`}
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
        {item.description && item.description.trim().length > 0 && (
          <View style={styles.tileCaption}>
            <Text style={styles.tileCaptionText} numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        )}
      </Pressable>
      )
    },
    [handleTilePress, tileSize, colors.fill2, t],
  )

  const keyExtractor = useCallback(
    (item: PhotoItem, index: number) => `${item.id}-${index}`,
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
      {photosQuery.isLoading ? (
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
        disabled={!planId}
        accessibilityRole="button"
        accessibilityLabel={t('planPhotos.addPhotoA11y')}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.gold,
            shadowColor: colors.gold,
            opacity: pressed || !planId ? 0.6 : 1,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
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
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  chip: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 99,
    alignItems: 'center',
  },
  chipLabel: {
    ...Type.caption1,
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
  tileCaption: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tileCaptionText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
})
