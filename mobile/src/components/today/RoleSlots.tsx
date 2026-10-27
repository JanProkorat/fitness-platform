import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import type { CoachRole, OfferedInvite } from './collaborationRoles';
import { RoleInviteCard } from './RoleInviteCard';
import { RoleRow } from './RoleRow';

type RoleSlotsProps = {
  /** Roles no coach covers yet. */
  missing: readonly CoachRole[];
  /** Pending invites that would fill some of those roles. */
  offers: readonly OfferedInvite[];
  /** "find" with no coach linked, "add" next to an existing one. */
  mode: 'find' | 'add';
  /** Shows the "Your coaches" heading and its subtitle. */
  showHeading?: boolean;
};

/** For each open role: the invite that would fill it, or a Find / Add row to search for a coach. */
export function RoleSlots({ missing, offers, mode, showHeading = false }: RoleSlotsProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);

  const offered = new Set(offers.flatMap((offer) => offer.roles));
  const rows = missing.filter((role) => !offered.has(role));
  const allDual = offers.length > 0 && offers.every((offer) => offer.roles.length > 1);

  const search = (role?: CoachRole) =>
    router.push(role ? { pathname: '/coach-search', params: { role } } : '/coach-search');

  return (
    <View style={styles.section}>
      {showHeading ? (
        <View style={styles.heading}>
          <Text variant="overline" color="muted" style={styles.overline}>
            {t('today.coaches.title').toUpperCase()}
          </Text>
          <Text variant="bodySmall" color="muted">
            {t(allDual ? 'today.coaches.subtitleBoth' : 'today.coaches.subtitle')}
          </Text>
        </View>
      ) : null}
      <View style={styles.cards}>
        {offers.map(({ invite, roles }) => {
          const id = invite.id ?? '';
          return (
            <RoleInviteCard
              key={id}
              invite={invite}
              roles={roles}
              onView={() => router.push({ pathname: '/invite/[id]', params: { id } })}
              onCompare={() => search(roles.length === 1 ? roles[0] : undefined)}
            />
          );
        })}
        {rows.map((role) => (
          <RoleRow key={role} role={role} mode={mode} onPress={() => search(role)} />
        ))}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xl,
    },
    heading: {
      gap: theme.spacing.xxs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    cards: {
      gap: theme.spacing.sm,
    },
  });
