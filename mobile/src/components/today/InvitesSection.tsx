import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { hasOpenProposal } from '@/api/clientRequests';
import { Text } from '@/components/Text';
import { useInvites } from '@/hooks/useInvites';
import { useMyClientRequests } from '@/hooks/useMyClientRequests';
import { useTheme } from '@/theme';
import { inviteMotion } from '@/theme/motion';
import type { Theme } from '@/theme';

import { InviteCard } from './InviteCard';
import { ProposalCard } from './ProposalCard';

/** Pending coach invitations and open package proposals on Today; renders nothing when there are none. */
export function InvitesSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { data: invites = [] } = useInvites();
  const { data: requests = [] } = useMyClientRequests();
  const proposals = requests.filter((request) => hasOpenProposal(request) && Boolean(request.publicId));

  if (invites.length === 0 && proposals.length === 0) return null;

  const title =
    proposals.length === 0
      ? t('today.invitesTitle')
      : invites.length === 0
        ? t('today.proposalsTitle')
        : t('today.invitesAndProposalsTitle');

  return (
    <Animated.View
      entering={FadeIn.reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(inviteMotion.exitDuration).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.reduceMotion(ReduceMotion.System)}
      style={styles.section}
    >
      <Text variant="overline" color="muted" style={styles.overline}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.cards}>
        {invites.map((invite, index) => {
          const id = invite.id ?? '';
          return (
            <InviteCard
              key={id}
              index={index}
              invite={invite}
              onOpen={() => router.push({ pathname: '/invite/[id]', params: { id } })}
            />
          );
        })}
        {proposals.map((request, index) => {
          const id = request.publicId ?? '';
          return (
            <ProposalCard
              key={`proposal-${id}`}
              index={invites.length + index}
              request={request}
              onOpen={() => router.push({ pathname: '/request/[id]', params: { id } })}
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
