import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  FlatList,
} from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { NotificationRow } from './NotificationRow'
import type { Notification } from '@/hooks/useNotifications'

const SCREEN_HEIGHT = Dimensions.get('window').height
const MAX_HEIGHT = SCREEN_HEIGHT * 0.82

interface NotificationSheetProps {
  visible: boolean
  onClose: () => void
  notifications: Notification[]
  onMarkAllRead: () => void
  onAction: (notification: Notification) => void
  onDismiss: (notification: Notification) => void
}

export function NotificationSheet({
  visible,
  onClose,
  notifications,
  onMarkAllRead,
  onAction,
  onDismiss,
}: NotificationSheetProps) {
  const colors = useTheme()
  const translateY = useRef(new Animated.Value(MAX_HEIGHT)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      Animated.parallel([
        Animated.spring(overlayOpacity, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: MAX_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false)
      })
    }
  }, [visible])

  if (!mounted) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
            maxHeight: MAX_HEIGHT,
            transform: [{ translateY }],
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.sep }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[Type.title2, { color: colors.label }]}>Notifications</Text>
          <Pressable onPress={onMarkAllRead}>
            <Text style={[Type.subheadline, { color: colors.blue }]}>Mark all as read</Text>
          </Pressable>
        </View>

        {/* List */}
        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[Type.body, { color: colors.label3, textAlign: 'center' }]}>
              No notifications yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationRow
                notification={item}
                onAction={onAction}
                onDismiss={onDismiss}
              />
            )}
            ItemSeparatorComponent={() => (
              <View style={[styles.sep, { backgroundColor: colors.sep2 }]} />
            )}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </View>
  )
}

export default NotificationSheet

const styles = StyleSheet.create({
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
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
  },
})
