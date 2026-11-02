import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClientRequestProposalDiscountDto, ClientRequestProposalPackageDto } from '@/api/generated';
import { billingChip, billingUnit, formatMoney, priceAfterDiscount } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ProposalPackageCardProps = {
  pack: ClientRequestProposalPackageDto;
  /** The discount the coach added; the card then shows only the price after it. */
  discount: ClientRequestProposalDiscountDto | undefined;
  /** What the package includes, from the coach's profile; left out when unknown. */
  description: string | undefined;
  /** First name of the coach who sends the payment requests. */
  coachFirstName: string;
  /** False while payments are hidden: prices and period units are left out. */
  showPrices: boolean;
};

/** The package a coach proposes: name, billing, what it includes and the final price, highlighted after a discount. */
export function ProposalPackageCard({ pack, discount, description, coachFirstName, showPrices }: ProposalPackageCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const discountName = discount?.name?.trim();
  const finalPrice = priceAfterDiscount(pack.price ?? 0, discount);
  const amount = formatMoney(finalPrice, pack.currency, i18n.language);

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.overline}>
        {t('requestProposal.package.title').toUpperCase()}
      </Text>
      <View style={styles.card}>
        <View style={styles.nameRow}>
          <Text variant="bodyStrong" style={styles.name}>
            {pack.name}
          </Text>
          <View style={styles.chip}>
            <Text variant="chipSmall" color="ink2">
              {billingChip(t, pack.billing, pack.intervalWeeks)}
            </Text>
          </View>
        </View>
        {description ? (
          <Text variant="bodySmall" color="ink2">
            {description}
          </Text>
        ) : null}
        {discountName ? (
          <View style={styles.pill}>
            <Text variant="chipSmall" color="nutritionInk">
              {discountName}
            </Text>
          </View>
        ) : null}
        {showPrices ? (
          <>
            <View style={styles.divider} />
            <View style={styles.payRow}>
              <Text variant="body" color="muted">
                {t('requestProposal.package.youPay')}
              </Text>
              <View style={[styles.amountBox, discount ? styles.amountHighlight : null]}>
                <Text variant="barTitle" color={discount ? 'nutritionInk' : 'ink'} style={styles.amount}>
                  {amount}{' '}
                  <Text variant="label" color="muted">
                    {billingUnit(t, pack.billing, pack.intervalWeeks)}
                  </Text>
                </Text>
              </View>
            </View>
          </>
        ) : null}
        <Text variant="caption" color="muted">
          {t('requestProposal.package.note', { name: coachFirstName })}
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
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    name: {
      flexShrink: 1,
    },
    chip: {
      marginLeft: 'auto',
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.hair,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.field,
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
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    amountBox: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.hair,
      borderRadius: theme.radii.md,
    },
    amountHighlight: {
      backgroundColor: theme.colors.nutritionSoft,
    },
    amount: {
      fontSize: theme.typography.heading.fontSize,
      lineHeight: theme.typography.heading.lineHeight,
    },
  });
