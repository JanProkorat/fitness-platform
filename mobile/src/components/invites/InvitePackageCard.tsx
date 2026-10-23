import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { InvitePackageDto } from '@/api/generated';
import { billingUnit, formatMoney } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type InvitePackageCardProps = {
  pack: InvitePackageDto;
  /** First name of the coach who sends the payment requests. */
  coachFirstName: string;
  /** False while payments are hidden: prices and period units are left out. */
  showPrices: boolean;
};

/** The package an invite assigns on accept: name, discount, what the client pays and how. */
export function InvitePackageCard({ pack, coachFirstName, showPrices }: InvitePackageCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const discount = pack.discountLabel?.trim();

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.overline}>
        {t('invites.detail.package.title').toUpperCase()}
      </Text>
      <View style={styles.card}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" style={styles.name}>
            {pack.name}
          </Text>
          {showPrices && discount ? (
            <Text variant="label" color="muted" style={styles.struck}>
              {formatMoney(pack.basePrice, pack.currency, i18n.language)}
            </Text>
          ) : null}
        </View>
        {discount ? (
          <View style={styles.pill}>
            <Text variant="chipSmall" color="nutritionInk">
              {discount}
            </Text>
          </View>
        ) : null}
        {showPrices ? (
          <>
            <View style={styles.divider} />
            <View style={styles.payRow}>
              <Text variant="body" color="muted">
                {t('invites.detail.package.youPay')}
              </Text>
              <Text variant="barTitle" style={styles.amount}>
                {formatMoney(pack.finalPrice, pack.currency, i18n.language)}{' '}
                <Text variant="label" color="muted">
                  {billingUnit(t, pack.billing, pack.intervalWeeks)}
                </Text>
              </Text>
            </View>
          </>
        ) : null}
        <Text variant="caption" color="muted">
          {t('invites.detail.package.note', { name: coachFirstName })}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: theme.spacing.snug,
    },
    overline: {
      paddingHorizontal: theme.spacing.xxs,
      letterSpacing: theme.typography.overline.letterSpacing,
    },
    card: {
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.xs,
    },
    name: {
      flexShrink: 1,
    },
    struck: {
      marginLeft: 'auto',
      textDecorationLine: 'line-through',
    },
    pill: {
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.hair,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.nutritionSoft,
    },
    divider: {
      height: theme.sizes.border,
      backgroundColor: theme.colors.line,
    },
    payRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    amount: {
      fontSize: theme.typography.heading.fontSize,
      lineHeight: theme.typography.heading.lineHeight,
    },
  });
