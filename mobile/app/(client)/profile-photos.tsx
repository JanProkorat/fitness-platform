/**
 * Profile Photos — cross-plan photo timeline.
 *
 * Prototype: docs/prototypes/mobile/scenes/profile-photos.html
 *
 * Layout:
 *   1. Stack header with back button (provided by the parent Stack in _layout.tsx).
 *   2. Category filter chips (All / Food / Progress / Free) — client-side filter
 *      applied to already-fetched groups so the count reflects all loaded data.
 *   3. Infinite-scroll SectionList of month-grouped 3-column grids.
 *      Each section header shows: month label + plan name sub-line.
 *   4. Empty state with camera icon and i18n copy.
 *
 * Pagination: groupByMonth=true, 6 groups per page, fetched via useInfiniteQuery.
 * Category filter: passed through to the API so the server pre-filters;
 * also used for chip counts once all groups are loaded client-side.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SectionList,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  type SectionListRenderItemInfo,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { Radius } from '@/constants/radius'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import {
  getMyPhotos,
  PlanPhotoCategory,
  type GetMyPhotosPageResult,
  type MonthGroupResponse,
  type ClientPhotoResponse,
} from '@/api/photos'

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 6 // month groups per page
const OUTER_MARGIN = 20 // horizontal margin each side of the photo grid

// ─── Types ───────────────────────────────────────────────────────────────────

type FilterCategory = 'All' | 'Food' | 'Body' | 'FreeForm'

interface PhotoSection {
  title: string
  yearMonth: string
  data: ClientPhotoResponse[][]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format "2026-04" → locale-aware month label, e.g. "April 2026".
 */
function formatYearMonth(yearMonth: string, locale: string): string {
  // yearMonth is "YYYY-MM"
  const [year, month] = yearMonth.split('-')
  if (!year || !month) return yearMonth
  try {
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  } catch {
    return yearMonth
  }
}

function categoryToApi(filter: FilterCategory): PlanPhotoCategory | null {
  switch (filter) {
    case 'Food':
      return PlanPhotoCategory.Food
    case 'Body':
      return PlanPhotoCategory.Body
    case 'FreeForm':
      return PlanPhotoCategory.FreeForm
    default:
      return null
  }
}

// ─── Row renderer (3 photos per row) ─────────────────────────────────────────

interface PhotoRowProps {
  row: ClientPhotoResponse[]
  tileSize: number
  onPress: (photo: ClientPhotoResponse, sectionYearMonth: string) => void
  sectionYearMonth: string
}

function PhotoRow({ row, tileSize, onPress, sectionYearMonth }: PhotoRowProps) {
  const colors = useTheme()
  return (
    <View style={styles.gridRow}>
      {row.map((photo) => (
        <Pressable
          key={photo.id ?? photo.blobUrl}
          onPress={() => onPress(photo, sectionYearMonth)}
          accessibilityRole="imagebutton"
          style={[styles.tile, { width: tileSize, height: tileSize, backgroundColor: colors.fill2 }]}
        >
          {photo.blobUrl ? (
            <Image
              source={{ uri: photo.blobUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="image-outline" size={20} color={colors.label3} />
          )}
          {/* Caption overlay — bottom strip so the trainer's note is visible
              without opening the lightbox. Matches the diary workflow tiles. */}
          {photo.description ? (
            <View style={[styles.tileCaption, { backgroundColor: colors.overlay }]}>
              <Text style={[styles.tileCaptionText, { color: colors.onAccent }]} numberOfLines={2}>
                {photo.description}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
      {/* Pad the last row so tiles stay left-aligned */}
      {row.length < 3 &&
        Array.from({ length: 3 - row.length }).map((_, i) => (
          <View key={`pad-${i}`} style={{ width: tileSize, height: tileSize }} />
        ))}
    </View>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProfilePhotosScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const colors = useTheme()
  const { width } = useWindowDimensions()

  // ── Filter state ──
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('All')

  // ── Lightbox state ──
  const [lightboxVisible, setLightboxVisible] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxNotes, setLightboxNotes] = useState<(string | null)[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // ── Tile dimensions: 3 columns, 4px gap, 20px outer margin each side ──
  const tileSize = (width - OUTER_MARGIN * 2 - GRID_GAP * 2) / 3

  // ── API category for current filter ──
  const apiCategory = categoryToApi(activeFilter)

  // ── Infinite query ──
  const query = useInfiniteQuery<GetMyPhotosPageResult>({
    queryKey: ['my-photos', activeFilter],
    queryFn: ({ pageParam }) =>
      getMyPhotos({
        page: pageParam as number,
        pageSize: PAGE_SIZE,
        groupByMonth: true,
        category: apiCategory,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const fetched = (lastPage.page - 1) * lastPage.pageSize + lastPage.groups.length
      return fetched < lastPage.totalCount ? lastPage.page + 1 : undefined
    },
  })

  // ── Per-category total counts ──
  // The infinite query above only knows the count for the active filter,
  // so the inactive chips would show no number. We fetch a tiny
  // groupByMonth=false / pageSize=1 page per category in parallel and read
  // X-Total-Count from the response — that header carries the photo total
  // for the requested filter without paying for the full payload.
  const COUNT_FILTERS: FilterCategory[] = ['All', 'Food', 'Body', 'FreeForm']
  const countQueries = useQueries({
    queries: COUNT_FILTERS.map((cat) => ({
      queryKey: ['my-photos-count', cat],
      queryFn: () =>
        getMyPhotos({
          page: 1,
          pageSize: 1,
          groupByMonth: false,
          category: categoryToApi(cat),
        }),
      // Counts shift slowly compared to scrolling — keep them warm for a
      // minute so flipping chips doesn't trigger 4 fresh requests each time.
      staleTime: 60_000,
    })),
  })
  const categoryCounts: Record<FilterCategory, number> = useMemo(() => {
    const out = { All: 0, Food: 0, Body: 0, FreeForm: 0 } as Record<FilterCategory, number>
    COUNT_FILTERS.forEach((cat, i) => {
      out[cat] = countQueries[i].data?.totalCount ?? 0
    })
    return out
    // COUNT_FILTERS is a stable array literal; the count queries object reference
    // changes every render but its `data` references are what we actually depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    countQueries[0].data?.totalCount,
    countQueries[1].data?.totalCount,
    countQueries[2].data?.totalCount,
    countQueries[3].data?.totalCount,
  ])

  // ── Flatten all fetched groups ──
  const allGroups = useMemo(
    () => query.data?.pages.flatMap((p) => p.groups) ?? [],
    [query.data],
  )

  // ── Total photo count (across all fetched groups) for the subtitle ──
  const totalPhotoCount = useMemo(
    () => allGroups.reduce((sum, g) => sum + (g.photos?.length ?? 0), 0),
    [allGroups],
  )

  // ── Build SectionList sections ──
  const sections = useMemo((): { yearMonth: string; monthLabel: string; photos: ClientPhotoResponse[] }[] => {
    return allGroups
      .filter((g): g is MonthGroupResponse & { yearMonth: string } => typeof g.yearMonth === 'string')
      .map((g) => ({
        yearMonth: g.yearMonth,
        monthLabel: formatYearMonth(g.yearMonth, i18n.language),
        photos: g.photos ?? [],
      }))
      .filter((s) => s.photos.length > 0)
  }, [allGroups, i18n.language])

  // ── Build SectionList data (each item is a row of ≤3 photos) ──
  const sectionListData = useMemo((): PhotoSection[] => {
    return sections.map((s) => {
      const rows: ClientPhotoResponse[][] = []
      for (let i = 0; i < s.photos.length; i += 3) {
        rows.push(s.photos.slice(i, i + 3))
      }
      return { title: s.monthLabel, yearMonth: s.yearMonth, data: rows }
    })
  }, [sections])

  // ── Handle tile press: open lightbox with all photos in that section ──
  const handleTilePress = useCallback(
    (photo: ClientPhotoResponse, sectionYearMonth: string) => {
      const section = allGroups.find((g) => g.yearMonth === sectionYearMonth)
      const sectionPhotos = section?.photos ?? []
      // Keep urls and notes index-aligned: drop entries with no blobUrl from
      // both arrays so the caption that shows with each photo is the one the
      // trainer wrote on it.
      const urls: string[] = []
      const notes: (string | null)[] = []
      let photoIndex = 0
      for (let i = 0; i < sectionPhotos.length; i++) {
        const p = sectionPhotos[i]
        if (typeof p.blobUrl !== 'string') continue
        if (p.id === photo.id || p.blobUrl === photo.blobUrl) {
          photoIndex = urls.length
        }
        urls.push(p.blobUrl)
        notes.push(p.description ?? null)
      }
      setLightboxImages(urls)
      setLightboxNotes(notes)
      setLightboxIndex(photoIndex)
      setLightboxVisible(true)
    },
    [allGroups],
  )

  const handleLightboxClose = useCallback(() => setLightboxVisible(false), [])

  // ── Load more on end reached ──
  const handleEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage()
    }
  }, [query])

  // ── Render: section header ──
  const renderSectionHeader = useCallback(
    ({ section }: { section: PhotoSection }) => (
      <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
        <Text style={[styles.sectionTitle, { color: colors.label }]}>{section.title}</Text>
      </View>
    ),
    [colors],
  )

  // ── Render: row of photos ──
  const renderItem = useCallback(
    ({ item, section }: SectionListRenderItemInfo<ClientPhotoResponse[], PhotoSection>) => (
      <View style={{ paddingHorizontal: OUTER_MARGIN }}>
        <PhotoRow
          row={item}
          tileSize={tileSize}
          onPress={handleTilePress}
          sectionYearMonth={section.yearMonth}
        />
      </View>
    ),
    [tileSize, handleTilePress],
  )

  const keyExtractor = useCallback(
    (item: ClientPhotoResponse[], index: number) =>
      `row-${index}-${item.map((p) => p.id ?? p.blobUrl ?? '').join(',')}`,
    [],
  )

  // ── Footer: loading spinner for next page ──
  const renderFooter = useCallback(() => {
    if (!query.isFetchingNextPage) return null
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.gold} />
      </View>
    )
  }, [query.isFetchingNextPage, colors.gold])

  // ── Chips ──
  const chips: { key: FilterCategory; label: string }[] = [
    { key: 'All', label: t('profilePhotos.categoryAll') },
    { key: 'Food', label: t('profilePhotos.categoryFood') },
    { key: 'Body', label: t('profilePhotos.categoryBody') },
    { key: 'FreeForm', label: t('profilePhotos.categoryFree') },
  ]

  const isInitialLoading = query.isLoading
  const isEmpty = !isInitialLoading && sectionListData.length === 0

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* ── Page header — same gold chevron + label pattern as the diary wizard ── */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.sep2 }]}>
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
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.label }]} numberOfLines={1}>
            {t('profilePhotos.title')}
          </Text>
          {totalPhotoCount > 0 && (
            <Text style={[styles.headerSub, { color: colors.label2 }]} numberOfLines={1}>
              {t('profilePhotos.totalCount', { count: totalPhotoCount })}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Category filter chips — fixed single row, no horizontal scroll ── */}
      <View style={[styles.chipsRow, { borderBottomColor: colors.sep2 }]}>
        {chips.map(({ key, label }) => {
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
                numberOfLines={1}
                style={[
                  styles.chipLabel,
                  { color: isActive ? colors.gold : colors.label },
                  isActive && styles.chipLabelActive,
                ]}
              >
                {label}
                <Text
                  style={[
                    styles.chipCount,
                    { color: isActive ? colors.gold : colors.label3 },
                  ]}
                >
                  {' '}({categoryCounts[key]})
                </Text>
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* ── Content ── */}
      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      ) : isEmpty ? (
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={48} color={colors.label3} />
          <Text style={[styles.emptyTitle, { color: colors.label2 }]}>
            {t('profilePhotos.emptyTitle')}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.label3 }]}>
            {t('profilePhotos.emptyBody')}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sectionListData}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
          SectionSeparatorComponent={() => <View style={{ height: 16 }} />}
        />
      )}

      {/* ── Lightbox ── */}
      <ImageLightbox
        visible={lightboxVisible}
        images={lightboxImages}
        imageNotes={lightboxNotes}
        startIndex={lightboxIndex}
        onClose={handleLightboxClose}
      />
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const GRID_GAP = 4
const HEADER_SIDE_WIDTH = 92

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Page header — gold chevron + "Zpět" label, mirrors the diary wizard
  pageHeader: {
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
  headerText: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  headerTitle: {
    ...Type.headline,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSub: {
    ...Type.caption1,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    width: HEADER_SIDE_WIDTH,
    flexShrink: 0,
  },

  // Chips — single row, no horizontal scroll. Each chip flexes equally so
  // the four labels (Vše / Jídlo / Tělo / Volné) always fit on one line.
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
  chipCount: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },

  // Section list
  listContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    ...Type.headline,
  },

  // Grid
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
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
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tileCaptionText: {
    fontSize: 10,
    lineHeight: 12,
  },

  // Empty state
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    ...Type.headline,
    textAlign: 'center',
  },
  emptyBody: {
    ...Type.subheadline,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
})
