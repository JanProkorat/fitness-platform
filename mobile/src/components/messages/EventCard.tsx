import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { CooperationCardStatus } from '@/api/generated';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

export type EventCardKind = 'invite' | 'request';
export type EventCardDomain = 'training' | 'nutrition' | 'both';

type EventCardProps = {
  kind: EventCardKind;
  status: CooperationCardStatus;
  /** First name or full name of the coach the card is about. */
  name: string;
  domain: EventCardDomain;
  /** Sent by the signed-in client: the card sits on the right. */
  own: boolean;
  /** Scope of a pending invite, when the conversation carries it. */
  scopeText?: string;
  /** "expires in 7 days"; omitted when the invite is not in the pending list. */
  expiryText?: string;
  /** Date of the row that settled the card. */
  dateText?: string;
  /** Opens the invite detail; set only for a pending invite the client received. */
  onViewInvite?: () => void;
};

const DOMAIN_SYMBOLS: Record<EventCardDomain, SFSymbol> = {
  training: 'dumbbell',
  nutrition: 'leaf',
  both: 'figure.strengthtraining.traditional',
};

/** Invite or request card in a chat: one shape for every state, only the label and detail change. */
export function EventCard({
  kind,
  status,
  name,
  domain,
  own,
  scopeText,
  expiryText,
  dateText,
  onViewInvite,
}: EventCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const pending = status === CooperationCardStatus.Pending;
  const settled = status === CooperationCardStatus.Accepted;

  const training = domain === 'training';
  const tone = pending
    ? training
      ? { background: theme.colors.trainingSoft, ink: theme.colors.trainingInk }
      : { background: theme.colors.nutritionSoft, ink: theme.colors.nutritionInk }
    : { background: theme.colors.field, ink: theme.colors.ink };
  const labelColor = pending || settled ? (training ? theme.colors.trainingInk : theme.colors.nutritionInk) : theme.colors.muted;

  const label = t(`chat.card.${kind}.labels.${status}`);
  const detailKey = `chat.card.${kind}.details.${status}`;
  const detail =
    pending && kind === 'invite'
      ? [scopeText, expiryText].filter(Boolean).join(' · ')
      : [t(detailKey, { name }), dateText].filter(Boolean).join(' · ');

  return (
    <View style={[styles.card, own ? styles.own : styles.other]}>
      <View style={styles.body}>
        <View style={[styles.icon, { backgroundColor: tone.background }]}>
          <SymbolView name={DOMAIN_SYMBOLS[domain]} tintColor={tone.ink} size={theme.sizes.coachGlyph} />
        </View>
        <View style={styles.copy}>
          <Text variant="labelStrong" style={{ color: labelColor }}>
            {label}
          </Text>
          <Text variant="subtitle">{t(`chat.card.${kind}.title`, { name })}</Text>
          {detail ? (
            <Text variant="bodySmall" color="muted">
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      {onViewInvite ? (
        <Button label={t('invites.viewInvite')} size="small" onPress={onViewInvite} style={styles.view} />
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      maxWidth: '88%',
      gap: theme.spacing.lg,
      padding: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    own: {
      alignSelf: 'flex-end',
    },
    other: {
      alignSelf: 'flex-start',
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    icon: {
      width: theme.sizes.coachAvatar,
      height: theme.sizes.coachAvatar,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    view: {
      height: theme.sizes.inviteButton,
    },
    copy: {
      flexShrink: 1,
      gap: theme.spacing.xxs,
    },
  });
