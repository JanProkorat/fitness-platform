import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Text,
  BackHandler,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ImageLightboxProps {
  visible: boolean
  images: string[]
  startIndex?: number
  onClose: () => void
  /**
   * Optional meal-level diary note. When non-empty, renders a translucent
   * pill at the top of the screen (below safe-area inset), visible across all
   * images. Stays constant as the user swipes — it is the meal-level note,
   * not a per-image caption.
   */
  mealNote?: string | null
  /**
   * Optional per-image captions, index-aligned with `images`. When the user
   * is on image at index `i` and `imageNotes[i]` is non-empty, a translucent
   * bottom overlay caption is rendered (above the dot indicator). Updates as
   * the user swipes.
   */
  imageNotes?: (string | null | undefined)[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageLightbox({
  visible,
  images,
  startIndex = 0,
  onClose,
  mealNote,
  imageNotes,
}: ImageLightboxProps) {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<string>>(null)
  const currentIndexRef = useRef(startIndex)
  const [currentIndex, setCurrentIndex] = useState(startIndex)

  // Derived caption values — computed once per render from current index
  const trimmedMealNote = mealNote?.trim() || null
  const currentImageNote = imageNotes?.[currentIndex]?.trim() || null

  // Scroll to the starting image when the modal opens or startIndex changes
  useEffect(() => {
    if (visible && images.length > 0) {
      currentIndexRef.current = startIndex
      setCurrentIndex(startIndex)
      // Use a minimal delay to let the FlatList mount before scrolling
      const timer = setTimeout(() => {
        listRef.current?.scrollToIndex({ index: startIndex, animated: false })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [visible, startIndex, images.length])

  // Android hardware back button closes the lightbox
  useEffect(() => {
    if (!visible) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => sub.remove()
  }, [visible, onClose])

  const goToPrev = useCallback(() => {
    const next = Math.max(0, currentIndexRef.current - 1)
    currentIndexRef.current = next
    setCurrentIndex(next)
    listRef.current?.scrollToIndex({ index: next, animated: true })
  }, [])

  const goToNext = useCallback(() => {
    const next = Math.min(images.length - 1, currentIndexRef.current + 1)
    currentIndexRef.current = next
    setCurrentIndex(next)
    listRef.current?.scrollToIndex({ index: next, animated: true })
  }, [images.length])

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems[0]?.index != null) {
        currentIndexRef.current = viewableItems[0].index
        setCurrentIndex(viewableItems[0].index)
      }
    },
    []
  )

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<string>) => (
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={{ uri: item }}
          style={{ width, height }}
          resizeMode="contain"
        />
      </View>
    ),
    [width, height]
  )

  const keyExtractor = useCallback((_: string, index: number) => String(index), [])

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  )

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Black backdrop */}
      <View style={styles.backdrop}>
        {/* Full-screen paginated image list */}
        <FlatList
          ref={listRef}
          data={images}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={getItemLayout}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          initialScrollIndex={startIndex}
          scrollEnabled={images.length > 1}
        />

        {/* Close button — top right, respecting safe area */}
        <Pressable
          onPress={onClose}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          accessibilityLabel={t('imageLightbox.close')}
          hitSlop={12}
        >
          <Ionicons name="close" size={28} color="white" />
        </Pressable>

        {/* Meal-level note — top overlay, below safe-area inset, constant across all images */}
        {trimmedMealNote ? (
          <View
            style={[
              styles.noteOverlayTop,
              { top: insets.top + 60, marginHorizontal: 16 },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.noteOverlayText} numberOfLines={4}>
              {trimmedMealNote}
            </Text>
          </View>
        ) : null}

        {/* Per-image note — bottom overlay, above dot indicator, updates on swipe */}
        {currentImageNote ? (
          <View
            style={[
              styles.noteOverlayBottom,
              { bottom: insets.bottom + (images.length > 1 ? 48 : 16) },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.noteOverlayText} numberOfLines={4}>
              {currentImageNote}
            </Text>
          </View>
        ) : null}

        {/* Prev / next chevrons — only shown when more than one image */}
        {images.length > 1 && (
          <>
            <Pressable
              onPress={goToPrev}
              style={[styles.navBtn, styles.navLeft, { bottom: insets.bottom + 40 }]}
              accessibilityLabel={t('imageLightbox.previous')}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={32} color="white" />
            </Pressable>
            <Pressable
              onPress={goToNext}
              style={[styles.navBtn, styles.navRight, { bottom: insets.bottom + 40 }]}
              accessibilityLabel={t('imageLightbox.next')}
              hitSlop={12}
            >
              <Ionicons name="chevron-forward" size={32} color="white" />
            </Pressable>
          </>
        )}

        {/* Image counter dot row */}
        {images.length > 1 && (
          <View style={[styles.dotRow, { bottom: insets.bottom + 12 }]}>
            {images.map((_, i) => (
              <Text
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                ]}
              >
                •
              </Text>
            ))}
          </View>
        )}
      </View>
    </Modal>
  )
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: 16 },
  navRight: { right: 16 },
  dotRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    lineHeight: 20,
  },
  dotActive: {
    color: 'white',
  },
  /**
   * Translucent pill overlay for the meal-level note (top) and per-image
   * caption (bottom). Same visual style — same component style key, positioned
   * differently via inline `top`/`bottom` values.
   */
  noteOverlayTop: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteOverlayBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteOverlayText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
})

export default ImageLightbox
