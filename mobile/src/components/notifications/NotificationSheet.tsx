import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/hooks/useTheme'
import { Type } from '@/constants/typography'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { NotificationRow } from './NotificationRow'
import type { Notification } from '@/hooks/useNotifications'

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
  const { t } = useTranslation()

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('notifications.sheetTitle')}
      headerRight={
        <Pressable onPress={onMarkAllRead}>
          <Text style={[Type.subheadline, { color: colors.blue }]}>{t('notifications.markAllRead')}</Text>
        </Pressable>
      }
    >
      {/* List */}
      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[Type.body, { color: colors.label3, textAlign: 'center' }]}>
            {t('notifications.empty')}
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </BottomSheet>
  )
}

export default NotificationSheet

const styles = StyleSheet.create({
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 72,
  },
})
