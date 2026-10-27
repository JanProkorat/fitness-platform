import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PaymentCoach } from '@/api/payments';
import { Text } from '@/components/Text';
import { firstName } from '@/components/invites/format';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { PaidList } from './PaidList';
import { PaymentCard } from './PaymentCard';

type CoachSectionProps = {
  coach: PaymentCoach;
  /** False when the coach is named in the navigation bar instead. */
  showHeading?: boolean;
};

/** True when the coach has any requested or paid payment. */
export function hasPayments(coach: PaymentCoach): boolean {
  return (coach.requested?.length ?? 0) > 0 || (coach.paid?.length ?? 0) > 0;
}

/** "COACH · package" for a coach, upper-cased. */
export function coachHeading(coach: PaymentCoach): string {
  const packageName = ((coach.requested ?? [])[0] ?? (coach.paid ?? [])[0])?.name?.trim();
  return [coach.coachName, packageName].filter(Boolean).join(' · ').toUpperCase();
}

/** One coach: optional "COACH · package" heading, a card per requested payment, then the paid history. */
export function CoachSection({ coach, showHeading = true }: CoachSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  // A missing flag counts as the current collaboration.
  const requested = (coach.requested ?? []).filter((p) => !p.isEarlierCollaboration);
  const paid = (coach.paid ?? []).filter((p) => !p.isEarlierCollaboration);
  const earlierRequested = (coach.requested ?? []).filter((p) => p.isEarlierCollaboration);
  const earlierPaid = (coach.paid ?? []).filter((p) => p.isEarlierCollaboration);
  const hasEarlier = earlierRequested.length > 0 || earlierPaid.length > 0;
  const coachFirstName = firstName(coach.coachName);

  return (
    <View style={styles.section}>
      {showHeading ? (
        <Text variant="overline" color="muted" style={styles.overline} accessibilityRole="header">
          {coachHeading(coach)}
        </Text>
      ) : null}
      {coach.collaborationEnded ? (
        <Text variant="caption" color="muted">
          {t('payments.collaborationEnded')}
        </Text>
      ) : null}
      {requested.map((payment) => (
        <PaymentCard key={payment.paymentId} payment={payment} coachFirstName={coachFirstName} />
      ))}
      {paid.length > 0 ? (
        <View style={styles.paid}>
          <Text variant="overline" color="muted" style={styles.overline}>
            {t('payments.paid').toUpperCase()}
          </Text>
          <PaidList payments={paid} />
        </View>
      ) : null}
      {hasEarlier ? (
        <View style={styles.section}>
          <Text variant="overline" color="muted" style={styles.overline} accessibilityRole="header">
            {t('payments.earlierCollaboration').toUpperCase()}
          </Text>
          {earlierRequested.map((payment) => (
            <PaymentCard key={payment.paymentId} payment={payment} coachFirstName={coachFirstName} />
          ))}
          {earlierPaid.length > 0 ? <PaidList payments={earlierPaid} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.lg,
    },
    paid: {
      gap: theme.spacing.xs,
    },
    overline: {
      letterSpacing: theme.typography.overline.letterSpacing,
    },
  });
