import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { PaymentItem } from '@/api/payments';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { formatMoney, periodLabel, shortDay } from './format';

type PaidListProps = {
  payments: PaymentItem[];
};

/** A coach's paid payments, most recent first: period, amount and a check mark. */
export function PaidList({ payments }: PaidListProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.card}>
      {payments.map((payment, index) => {
        const label = periodLabel(payment.periodStart, payment.name, i18n.language);
        const amount = formatMoney(payment.amount, payment.currency, i18n.language);
        const paidOn = shortDay(payment.paidOn, i18n.language);
        return (
          <View
            key={payment.paymentId ?? index}
            accessible
            accessibilityLabel={[label, amount, paidOn ? t('payments.paidOn', { date: paidOn }) : t('payments.paid')].join(', ')}
            style={[styles.row, index > 0 && styles.divider]}
          >
            <Text variant="body" style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            <Text variant="body" style={styles.amount}>
              {amount}
            </Text>
            <SymbolView name="checkmark" tintColor={theme.colors.success} size={theme.sizes.paidGlyph} />
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    label: {
      flex: 1,
      minWidth: 0,
    },
    amount: {
      fontVariant: ['tabular-nums'],
    },
  });
