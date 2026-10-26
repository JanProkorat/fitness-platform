import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isOverdue } from '@/api/payments';
import type { PaymentItem } from '@/api/payments';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { CopyRow } from './CopyRow';
import { QrTile } from './QrTile';
import { compactIban, dueLine, formatMoney, groupIban, periodLabel } from './format';

type PaymentCardProps = {
  payment: PaymentItem;
  /** First name of the coach, for "X confirms when the money arrives". */
  coachFirstName: string;
};

/** One requested payment: amount, due date, QR code and the transfer details with copy buttons. */
export function PaymentCard({ payment, coachFirstName }: PaymentCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const overdue = isOverdue(payment);
  // The API sends null for absent fields, so null and '' both mean "not there".
  const { iban, variableSymbol, message, qrPayload } = payment;
  const hasQr = qrPayload != null && qrPayload !== '';
  const rows = [
    iban != null && iban !== ''
      ? { key: 'iban', label: t('payments.account'), value: groupIban(iban), copyValue: compactIban(iban) }
      : null,
    variableSymbol != null && variableSymbol !== ''
      ? { key: 'vs', label: t('payments.variableSymbol'), value: variableSymbol, copyValue: undefined }
      : null,
    message != null && message !== ''
      ? { key: 'message', label: t('payments.message'), value: message, copyValue: undefined }
      : null,
  ].filter((row) => row !== null);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.amountBlock}>
          <Text variant="label" color="muted">
            {periodLabel(payment.periodStart, payment.name, i18n.language)}
          </Text>
          <Text variant="display" style={styles.amount}>
            {formatMoney(payment.amount, payment.currency, i18n.language)}
          </Text>
          <Text variant="label" color="muted">
            {dueLine(t, payment.dueDate, payment.discountLabel, payment.isCustomPrice, i18n.language)}
          </Text>
        </View>
        <View style={[styles.tag, overdue ? styles.tagOverdue : styles.tagDue]}>
          <Text variant="captionStrong" color={overdue ? 'error' : 'warning'}>
            {overdue ? t('payments.overdue') : t('payments.toPay')}
          </Text>
        </View>
      </View>

      {hasQr ? <QrTile payload={qrPayload} accessibilityLabel={t('payments.qrLabel')} /> : null}

      <Text variant="label" color="muted" style={styles.caption}>
        {t(hasQr ? 'payments.scan' : 'payments.transfer', { name: coachFirstName })}
      </Text>

      {rows.length > 0 ? (
        <View style={styles.details}>
          {rows.map((row, index) => (
            <CopyRow
              key={row.key}
              label={row.label}
              value={row.value}
              copyValue={row.copyValue}
              divider={index > 0}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xxl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.md,
    },
    amountBlock: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs,
    },
    amount: {
      fontVariant: ['tabular-nums'],
    },
    tag: {
      height: theme.sizes.statusTag,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagDue: {
      backgroundColor: theme.colors.warningSoft,
    },
    tagOverdue: {
      backgroundColor: theme.colors.errorSoft,
    },
    caption: {
      textAlign: 'center',
    },
    details: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
  });
