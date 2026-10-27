import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { ClientInvite } from '@/api/invites';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { relativeTime } from '@/components/invites/format';
import { billingUnit, formatMoney } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import Animated, { useReducedMotion, withTiming } from 'react-native-reanimated';
import type { EntryAnimationsValues } from 'react-native-reanimated';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { roleInviteMotion } from '@/theme/motion';

import type { CoachRole } from './collaborationRoles';
import { roleLook } from './roleLook';

type RoleInviteCardProps = {
  invite: ClientInvite;
  /** One role for a single-role invite, both for a dual-role one. */
  roles: CoachRole[];
  onView: () => void;
  onCompare: () => void;
};

/** A pending invite on Today, shown in place of the "Find / Add a <role>" row it would fill. */
export function RoleInviteCard({ invite, roles, onView, onCompare }: RoleInviteCardProps) {
  const { t, i18n } = useTranslation();
  const { enabled: paymentsEnabled } = usePaymentsEnabled();
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const styles = makeStyles(theme);
  const dual = roles.length > 1;
  const first = roles[0] ?? 'Trainer';
  const borderColor = dual ? theme.colors.ink : roleLook(theme, first).strong;
  const label = roles.map((role) => t(`invites.roles.${role}`)).join(t('invites.roleJoiner'));
  const name = t('today.invite.invitedYou', { name: invite.coachName ?? '' });
  const pack = invite.package;
  const when = relativeTime(t, invite.sentAt);
  const meta =
    pack && paymentsEnabled
      ? `${when} · ${t('today.invite.packagePrice', {
          price: `${formatMoney(pack.finalPrice, pack.currency, i18n.language)} ${billingUnit(t, pack.billing, pack.intervalWeeks)}`,
        })}`
      : when;

  const offset = theme.spacing[roleInviteMotion.offsetSpacing];
  const entering = (values: EntryAnimationsValues) => {
    'worklet';
    return {
      initialValues: { opacity: 0, originY: values.targetOriginY + offset },
      animations: {
        opacity: withTiming(1, { duration: roleInviteMotion.duration }),
        originY: withTiming(values.targetOriginY, { duration: roleInviteMotion.duration }),
      },
    };
  };

  return (
    <Animated.View
      entering={reduceMotion ? undefined : entering}
      style={[styles.card, { borderColor }]}
    >
      <View style={styles.header}>
        <View style={styles.icons}>
          {roles.map((role, index) => {
            const look = roleLook(theme, role);
            return (
              <View
                key={role}
                style={[styles.icon, { backgroundColor: look.soft }, index > 0 && styles.overlap]}
              >
                <SymbolView name={look.symbol} tintColor={look.ink} size={theme.sizes.stackGlyph} />
              </View>
            );
          })}
        </View>
        <Text
          variant="captionStrong"
          style={[styles.label, { color: dual ? theme.colors.ink : roleLook(theme, first).ink }]}
        >
          {label.toUpperCase()}
        </Text>
        <View style={styles.badge}>
          <Text variant="chipSmall" color="onAccent">
            {t('today.invite.newBadge')}
          </Text>
        </View>
      </View>
      <View style={styles.who}>
        <InviteAvatar name={invite.coachName} />
        <View style={styles.copy}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {name}
          </Text>
          <Text variant="caption" color="muted">
            {meta}
          </Text>
        </View>
      </View>
      {dual ? (
        <View style={styles.tiles}>
          {roles.map((role) => {
            const look = roleLook(theme, role);
            return (
              <View key={role} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: look.soft }]}>
                  <SymbolView name={look.symbol} tintColor={look.ink} size={theme.sizes.tileGlyph} />
                </View>
                <Text variant="labelStrong" numberOfLines={1} style={styles.tileLabel}>
                  {t(role === 'Trainer' ? 'today.invite.planTraining' : 'today.invite.planNutrition')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('today.invite.view')}
          onPress={onView}
          style={[styles.button, styles.primary]}
        >
          <Text variant="button" color="onPrimary" numberOfLines={1}>
            {t('today.invite.view')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('today.invite.compare')}
          onPress={onCompare}
          style={[styles.button, styles.secondary]}
        >
          <SymbolView name="magnifyingglass" tintColor={theme.colors.ink} size={theme.sizes.stepDotGlyph} />
          <Text variant="link" numberOfLines={1}>
            {t('today.invite.compare')}
          </Text>
        </Pressable>
      </View>
      <Text variant="caption" color="muted">
        {t(dual ? 'today.invite.footnoteBoth' : 'today.invite.footnote')}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.xl,
      borderRadius: theme.radii.card,
      borderWidth: theme.sizes.borderStrong,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    icons: {
      flexDirection: 'row',
    },
    icon: {
      width: theme.sizes.stackIcon,
      height: theme.sizes.stackIcon,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.stepLine,
      borderColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlap: {
      marginLeft: -theme.spacing.snug,
    },
    label: {
      flex: 1,
      minWidth: 0,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    badge: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xxs / 2,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.accent,
    },
    who: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
    tiles: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    tile: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.field,
      backgroundColor: theme.colors.subtle,
    },
    tileIcon: {
      width: theme.sizes.tileIcon,
      height: theme.sizes.tileIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: {
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    button: {
      flex: 1,
      minWidth: 0,
      height: theme.sizes.buttonMedium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.snug,
      borderRadius: theme.radii.pill,
    },
    primary: {
      backgroundColor: theme.colors.primary,
    },
    secondary: {
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.lineStrong,
      backgroundColor: theme.colors.surface,
    },
  });
