import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { countOpenPayments, isOverdue } from '@/api/payments';
import { Text } from '@/components/Text';
import { formatMoney } from '@/components/payments/format';
import { usePayments } from '@/hooks/usePayments';
import { usePaymentsEnabled } from '@/hooks/usePaymentsEnabled';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** "Payment due" on Today while a payment is requested or overdue; nothing when payments are hidden or none is open. */
export function PaymentDueCard() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { enabled } = usePaymentsEnabled();
  const { data: coaches } = usePayments(enabled);

  if (!enabled || !coaches) return null;
  const open = countOpenPayments(coaches);
  if (open === 0) return null;

  const requested = coaches.flatMap((coach) => (coach.requested ?? []).map((payment) => ({ coach, payment })));
  const overdue = requested.some(({ payment }) => isOverdue(payment));
  const only = requested.length === 1 ? requested[0] : undefined;
  const title = overdue ? t('payments.card.titleOverdue') : t('payments.card.title');
  const body = only
    ? t('payments.card.single', {
        amount: formatMoney(only.payment.amount, only.payment.currency, i18n.language),
        coach: only.coach.coachName ?? '',
      })
    : t('payments.card.several', { count: open });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      accessibilityHint={t('payments.card.hint')}
      onPress={() => router.push('/payments')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.icon, overdue ? styles.iconOverdue : styles.iconDue]}>
        <SymbolView
          name="creditcard"
          tintColor={overdue ? theme.colors.error : theme.colors.warning}
          size={theme.sizes.paymentGlyph}
        />
      </View>
      <View style={styles.copy}>
        <Text variant="subtitle" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySmall" color="muted" numberOfLines={1}>
          {body}
        </Text>
      </View>
      <SymbolView name="chevron.right" tintColor={theme.colors.muted} size={theme.sizes.coachChevron} />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    pressed: {
      opacity: theme.opacity.pressed,
    },
    icon: {
      width: theme.sizes.coachIcon,
      height: theme.sizes.coachIcon,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconDue: {
      backgroundColor: theme.colors.warningSoft,
    },
    iconOverdue: {
      backgroundColor: theme.colors.errorSoft,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
  });
