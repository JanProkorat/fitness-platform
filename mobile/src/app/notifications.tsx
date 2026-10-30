import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  getNotificationInviteId,
  getNotificationPayload,
  isNutritionPlanPayload,
  NOTIFICATIONS_QUERY_KEY,
} from '@/api/notifications';
import type { AppNotification } from '@/api/notifications';
import { isPaymentRequestedType } from '@/api/payments';
import { NotificationRow } from '@/components/notifications/NotificationRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Text } from '@/components/Text';
import { useInvites } from '@/hooks/useInvites';
import { useMarkNotificationsRead, useNotifications } from '@/hooks/useNotifications';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { isOfflineEmpty, showsError } from '@/lib/queryState';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Notifications bottom sheet over Today: unread dot, mark read, mark all read, View invite. */
export default function NotificationsSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(theme, insets);
  const queryClient = useQueryClient();
  const notificationsQuery = useNotifications();
  const { data: page, isPending, refetch } = notificationsQuery;
  const { data: invites } = useInvites();
  const { markOne, markAll } = useMarkNotificationsRead();
  const payments = usePaymentsEnabled();

  // Opening the sheet always shows fresh data.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [queryClient]);

  const items = page?.items ?? [];
  const unreadCount = page?.unreadCount ?? 0;
  const todayStart = startOfToday();
  const today = items.filter((item) => isOnOrAfter(item, todayStart));
  const earlier = items.filter((item) => !isOnOrAfter(item, todayStart));

  const close = () => router.back();

  const open = (notification: AppNotification) => {
    if (notification.id && notification.read !== true) markOne(notification.id);
    if (isPaymentRequestedType(notification.type) && payments.enabled) router.replace('/payments');
    else if (isNutritionPlanPayload(getNotificationPayload(notification))) router.replace('/nutrition');
  };

  const viewInvite = (notification: AppNotification, inviteId: string) => {
    if (notification.id && notification.read !== true) markOne(notification.id);
    router.replace({ pathname: '/invite/[id]', params: { id: inviteId } });
  };

  const renderGroup = (label: string, group: AppNotification[]) =>
    group.length === 0 ? null : (
      <View key={label} style={styles.group}>
        <Text variant="overline" color="muted" style={styles.overline}>
          {label.toUpperCase()}
        </Text>
        {group.map((notification) => {
          const inviteId = getNotificationInviteId(notification);
          const invite = inviteId ? invites?.find((candidate) => candidate.id === inviteId) : undefined;
          return (
            <NotificationRow
              key={notification.id}
              notification={notification}
              invite={invite}
              onPress={() => open(notification)}
              onViewInvite={(id) => viewInvite(notification, id)}
            />
          );
        })}
      </View>
    );

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notifications.close')}
        onPress={close}
        style={styles.backdrop}
      />
      <View accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <Text variant="title" accessibilityRole="header" style={styles.title}>
              {t('notifications.title')}
            </Text>
            {unreadCount > 0 ? (
              <View style={styles.badge} accessibilityLabel={t('notifications.unreadCount', { count: unreadCount })}>
                <Text variant="captionStrong" style={{ color: theme.colors.onAccent }}>
                  {unreadCount}
                </Text>
              </View>
            ) : null}
          </View>
          {unreadCount > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={theme.spacing.xs} onPress={() => markAll()}>
              <Text variant="link" color="accent">
                {t('notifications.markAllRead')}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <OfflineBanner />
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {isOfflineEmpty(notificationsQuery) ? (
            <Text variant="body" color="muted">
              {t('offline.notSaved.title')}. {t('offline.notSaved.body')}
            </Text>
          ) : showsError(notificationsQuery) ? (
            <Pressable accessibilityRole="button" onPress={() => void refetch()}>
              <Text variant="body" color="muted">
                {t('notifications.error')}
              </Text>
            </Pressable>
          ) : null}
          {!isPending && page !== undefined && items.length === 0 ? (
            <Text variant="body" color="muted">
              {t('notifications.empty')}
            </Text>
          ) : null}
          {renderGroup(t('notifications.groupToday'), today)}
          {renderGroup(t('notifications.groupEarlier'), earlier)}
        </ScrollView>
      </View>
    </View>
  );
}

function isOnOrAfter(notification: AppNotification, start: number): boolean {
  const at = notification.timestamp ? Date.parse(notification.timestamp) : Number.NaN;
  return !Number.isNaN(at) && at >= start && at < start + DAY_MS;
}

const makeStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.glass.sheet.backdrop[theme.scheme],
    },
    backdrop: StyleSheet.absoluteFill,
    sheet: {
      maxHeight: '75%',
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      borderTopLeftRadius: theme.glass.sheet.radius,
      borderTopRightRadius: theme.glass.sheet.radius,
      backgroundColor: theme.colors.surface,
    },
    handle: {
      alignSelf: 'center',
      width: theme.glass.sheet.handleWidth,
      height: theme.glass.sheet.handleHeight,
      borderRadius: theme.radii.xs,
      backgroundColor: theme.colors.lineStrong,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    titleGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    title: {
      flexShrink: 1,
    },
    badge: {
      minWidth: theme.sizes.countBadge,
      height: theme.sizes.countBadge,
      paddingHorizontal: theme.spacing.xs,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.accent,
    },
    list: {
      flexGrow: 0,
    },
    listContent: {
      gap: theme.spacing.md,
    },
    group: {
      gap: theme.spacing.xs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
  });
