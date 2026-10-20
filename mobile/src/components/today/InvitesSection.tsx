import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { useInviteActions } from '@/hooks/useInviteActions';
import { useInvites } from '@/hooks/useInvites';
import { useTheme } from '@/theme';
import { inviteMotion } from '@/theme/motion';
import type { Theme } from '@/theme';

import { InviteCard } from './InviteCard';

/** Pending coach invitations on Today; renders nothing when there are none. */
export function InvitesSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: invites } = useInvites();
  const { accept, decline, pendingId } = useInviteActions();

  if (!invites || invites.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(inviteMotion.exitDuration).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.reduceMotion(ReduceMotion.System)}
      style={styles.section}
    >
      <Text variant="overline" color="muted" style={styles.overline}>
        {t('today.invitesTitle').toUpperCase()}
      </Text>
      <View style={styles.cards}>
        {invites.map((invite, index) => {
          const id = invite.id ?? '';
          return (
            <InviteCard
              key={id}
              index={index}
              invite={invite}
              busy={pendingId !== null}
              onOpen={() => router.push({ pathname: '/invite/[id]', params: { id } })}
              onAccept={() => accept(id)}
              onDecline={() => decline(id)}
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.xl,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    cards: {
      gap: theme.spacing.md,
    },
  });
