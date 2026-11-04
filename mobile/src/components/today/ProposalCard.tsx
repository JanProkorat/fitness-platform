import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import type { ClientRequest } from '@/api/clientRequests';
import { Button } from '@/components/Button';
import { InviteAvatar } from '@/components/invites/InviteAvatar';
import { relativeTime } from '@/components/invites/format';
import { proposalSummary } from '@/components/messages/format';
import { Text } from '@/components/Text';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { useTheme } from '@/theme';
import { inviteMotion } from '@/theme/motion';
import type { Theme } from '@/theme';

type ProposalCardProps = {
  request: ClientRequest;
  /** Position in the list; staggers the entrance. */
  index?: number;
  onOpen: () => void;
};

/** One open package proposal on Today: who proposed it, the package and final price, and a View proposal button. */
export function ProposalCard({ request, index = 0, onOpen }: ProposalCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { enabled: paymentsEnabled } = usePaymentsEnabled();
  const title = t('invites.proposedYou', { name: request.professionalName ?? '' });
  const summary = proposalSummary(t, i18n.language, request, paymentsEnabled);

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
        accessibilityHint={t('invites.openProposalHint')}
        onPress={onOpen}
        style={styles.header}
      >
        <InviteAvatar name={request.professionalName} />
        <View style={styles.copy}>
          <Text variant="subtitle" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="bodySmall" color="muted">
            {relativeTime(t, request.proposal?.proposedAt)}
          </Text>
        </View>
      </Pressable>
      {summary ? (
        <Text variant="caption" color="muted">
          {summary}
        </Text>
      ) : null}
      <Button label={t('invites.viewProposal')} size="small" onPress={onOpen} style={styles.view} />
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
  });
