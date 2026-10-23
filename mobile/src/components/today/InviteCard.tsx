import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import type { ClientInvite } from '@/api/invites';
import { Button } from '@/components/Button';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { RoleChip } from '@/components/invites/RoleChip';
import { relativeTime } from '@/components/invites/format';
import { billingUnit, formatMoney } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { useTheme } from '@/theme';
import { inviteMotion } from '@/theme/motion';
import type { Theme } from '@/theme';

type InviteCardProps = {
  invite: ClientInvite;
  /** Position in the list; staggers the entrance. */
  index?: number;
  onOpen: () => void;
};

/** One pending invitation on Today: who invited, their role, when, and a single View invite button. */
export function InviteCard({ invite, index = 0, onOpen }: InviteCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { enabled: paymentsEnabled } = usePaymentsEnabled();
  const title = t('invites.invitedYou', { name: invite.coachName ?? '' });
  const pack = invite.package;
  const hint = pack
    ? paymentsEnabled
      ? t('invites.includesPackagePrice', {
          price: `${formatMoney(pack.finalPrice, pack.currency, i18n.language)} ${billingUnit(t, pack.billing, pack.intervalWeeks)}`,
        })
      : t('invites.includesPackage')
    : null;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * inviteMotion.enterDelayStagger)
        .springify()
        .damping(inviteMotion.spring.damping)
        .stiffness(inviteMotion.spring.stiffness)
        .mass(inviteMotion.spring.mass)
        .reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(inviteMotion.exitDuration).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.springify()
        .damping(inviteMotion.spring.damping)
        .stiffness(inviteMotion.spring.stiffness)
        .mass(inviteMotion.spring.mass)
        .reduceMotion(ReduceMotion.System)}
      style={styles.card}
    >
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
      {hint ? (
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      ) : null}
      <Button
        label={t('invites.viewInvite')}
        size="small"
        onPress={onOpen}
        style={styles.view}
      />
    </Animated.View>
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
    view: {
      height: theme.sizes.inviteButton,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: theme.spacing.xs,
      rowGap: theme.spacing.xxs,
    },
  });
