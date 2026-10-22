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
};

/** One coach: "COACH · package" heading, a card per requested payment, then the paid history. */
export function CoachSection({ coach }: CoachSectionProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const requested = coach.requested ?? [];
  const paid = coach.paid ?? [];
  const packageName = (requested[0] ?? paid[0])?.name?.trim();
  const heading = [coach.coachName, packageName].filter(Boolean).join(' · ');

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.overline} accessibilityRole="header">
        {heading.toUpperCase()}
      </Text>
      {requested.map((payment) => (
        <PaymentCard key={payment.paymentId} payment={payment} coachFirstName={firstName(coach.coachName)} />
      ))}
      {paid.length > 0 ? (
        <View style={styles.paid}>
          <Text variant="overline" color="muted" style={styles.overline}>
            {t('payments.paid').toUpperCase()}
          </Text>
          <PaidList payments={paid} />
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
