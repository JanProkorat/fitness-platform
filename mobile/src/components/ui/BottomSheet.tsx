import React from 'react'
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/hooks/useTheme'
import { useBottomSheetAnimation } from '@/hooks/useBottomSheetAnimation'
import { Type } from '@/constants/typography'

const SCREEN_HEIGHT = Dimensions.get('window').height

interface BottomSheetProps {
  /** Controls visibility (animates in/out) */
  visible: boolean
  /** Called when the user taps the overlay or drag handle area */
  onClose: () => void
  /** Sheet title shown in the header */
  title?: string
  /** Optional element rendered on the right side of the header */
  headerRight?: React.ReactNode
  /** Sheet height as a fraction of screen height (0–1). Default 0.82.
   *  Acts as a hard cap when `fitContent` is true. */
  heightFraction?: number
  /** When true, the sheet sizes itself to its children up to the
   *  `heightFraction` cap, instead of always rendering at the cap. */
  fitContent?: boolean
  /** Sheet content */
  children: React.ReactNode
}

export function BottomSheet({
  visible,
  onClose,
  title,
  headerRight,
  heightFraction = 0.82,
  fitContent = false,
  children,
}: BottomSheetProps) {
  const colors = useTheme()
  const insets = useSafeAreaInsets()
  const maxHeight = SCREEN_HEIGHT * heightFraction
  const { translateY, overlayOpacity, mounted } = useBottomSheetAnimation(visible, maxHeight)

  if (!mounted) return null

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Overlay */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bg2,
              transform: [{ translateY }],
            },
            fitContent ? { maxHeight } : { height: maxHeight },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.sep }]} />
          </View>

          {/* Header (optional) */}
          {title && (
            <View style={styles.header}>
              <Text style={[Type.title2, { color: colors.label }]}>{title}</Text>
              {headerRight}
            </View>
          )}

          <View
            style={
              fitContent
                ? { paddingBottom: Math.max(insets.bottom, 16) }
                : { flex: 1, paddingBottom: Math.max(insets.bottom, 16) }
            }
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

export default BottomSheet

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
})
