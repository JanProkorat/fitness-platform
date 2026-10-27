import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getNotificationInviteId, getNotificationPayload } from '@/api/notifications';
import type { AppNotification } from '@/api/notifications';
import type { ClientInvite } from '@/api/invites';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { RoleChip } from '@/components/invites/RoleChip';
import { relativeTime } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type NotificationRowProps = {
  notification: AppNotification;
  /** The matching pending invite, when the notification is an invitation that is still open. */
  invite: ClientInvite | undefined;
  onPress: () => void;
  onViewInvite: (inviteId: string) => void;
};

/** One notification: avatar, title, time, unread dot, preview and, for an open invite, View invite. */
export function NotificationRow({ notification, invite, onPress, onViewInvite }: NotificationRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const unread = notification.read !== true;
  const inviteId = getNotificationInviteId(notification);
  const payload = getNotificationPayload(notification);
  const coachName = invite?.coachName ?? payload.trainerName ?? payload.coachName;
  const preview = invite?.message?.trim() || notification.body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? `${t('notifications.unread')}. ` : ''}${notification.title ?? ''}`}
      onPress={onPress}
      style={styles.row}
    >
      <InviteAvatar name={coachName} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text variant="subtitle" numberOfLines={1} style={styles.title}>
            {notification.title}
          </Text>
          <Text variant="bodySmall" color="muted">
            {relativeTime(t, notification.timestamp)}
          </Text>
          <View style={[styles.dot, !unread && styles.dotRead]} />
        </View>
        {invite ? <RoleChip coachRole={invite.coachRole} /> : null}
        {preview ? (
          <Text variant="body" color="ink2" numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
        {invite && inviteId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onViewInvite(inviteId)}
            style={({ pressed }) => [styles.view, pressed && styles.pressed]}
          >
            <Text variant="buttonSmall" style={{ color: theme.colors.onPrimary }}>
              {t('notifications.viewInvite')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    title: {
      flex: 1,
    },
    dot: {
      width: theme.sizes.unreadDot,
      height: theme.sizes.unreadDot,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accent,
    },
    dotRead: {
      backgroundColor: 'transparent',
    },
    view: {
      alignSelf: 'flex-start',
      height: theme.sizes.buttonSmall,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
  });
