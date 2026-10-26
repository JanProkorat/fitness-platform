import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PublicProfilePackageDto } from '@/api/generated';
import { billingChip, billingUnit, formatMoney } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PackageCardProps = {
  pack: PublicProfilePackageDto;
  width: number;
  /** False while payments are hidden: the price and its period unit are left out. */
  showPrices: boolean;
};

/** One package on a coach profile: name, billing type, price and what it includes. */
export function PackageCard({ pack, width, showPrices }: PackageCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const description = pack.description?.trim();

  return (
    <View accessible accessibilityLabel={pack.name} style={[styles.card, { width }]}>
      <View style={styles.nameRow}>
        <Text variant="subtitle" style={styles.name}>
          {pack.name}
        </Text>
        <View style={styles.chip}>
          <Text variant="chipSmall" color="ink2">
            {billingChip(t, pack.billing, pack.intervalWeeks)}
          </Text>
        </View>
      </View>
      {showPrices ? (
        <View style={styles.priceRow}>
          <Text variant="display">{formatMoney(pack.price, pack.currency, i18n.language)}</Text>
          <Text variant="bodySmall" color="muted">
            {billingUnit(t, pack.billing, pack.intervalWeeks)}
          </Text>
        </View>
      ) : null}
      {description ? (
        <>
          <View style={styles.divider} />
          <Text variant="bodySmall" color="ink2">
            {description}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: theme.spacing.md,
      padding: theme.spacing.cardInset,
      borderRadius: theme.radii.xxl,
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
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.snug,
    },
    divider: {
      height: theme.sizes.border,
      backgroundColor: theme.colors.line,
    },
  });
