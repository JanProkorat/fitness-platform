import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ClientRequestProposalDiscountDto, ClientRequestProposalPackageDto } from '@/api/generated';
import { PackageCard } from '@/components/coach/PackageCard';
import { priceAfterDiscount } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ProposalPackageCardProps = {
  pack: ClientRequestProposalPackageDto;
  /** The discount the coach added; the card then shows only the price after it, highlighted. */
  discount: ClientRequestProposalDiscountDto | undefined;
  /** What the package includes, from the coach's profile; left out when unknown. */
  description: string | undefined;
  /** False while payments are hidden: the price and its period unit are left out. */
  showPrices: boolean;
};

/** The package a coach proposes: the profile's package card with the final price after any discount. */
export function ProposalPackageCard({ pack, discount, description, showPrices }: ProposalPackageCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const discountName = discount?.name?.trim();

  return (
    <View style={styles.section}>
      <Text variant="overline" color="muted" style={styles.overline}>
        {t('requestProposal.package.title').toUpperCase()}
      </Text>
      <PackageCard
        pack={{ ...pack, price: priceAfterDiscount(pack.price ?? 0, discount), description }}
        showPrices={showPrices}
        discountLabel={discountName || undefined}
      />
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
  });
