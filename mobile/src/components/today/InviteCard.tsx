import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClientInvite } from '@/api/invites';
import { InviteActions } from '@/components/invites/InviteActions';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { RoleChip } from '@/components/invites/RoleChip';
import { relativeTime } from '@/components/invites/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type InviteCardProps = {
  invite: ClientInvite;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
};

/** One pending invitation on Today: who invited, their role, when, and Accept / Decline. */
export function InviteCard({ invite, busy, onOpen, onAccept, onDecline }: InviteCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const title = t('invites.invitedYou', { name: invite.coachName ?? '' });

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={t('invites.openHint')}
        onPress={onOpen}
        style={styles.header}
      >
        <InviteAvatar name={invite.coachName} />
        <View style={styles.copy}>
          <Text variant="subtitle" numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.meta}>
            <RoleChip coachRole={invite.coachRole} />
            <Text variant="bodySmall" color="muted">
              {relativeTime(t, invite.sentAt)}
            </Text>
          </View>
        </View>
      </Pressable>
      <InviteActions size="card" busy={busy} onAccept={onAccept} onDecline={onDecline} />
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
  });
