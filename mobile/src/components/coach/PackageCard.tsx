import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { PublicProfilePackageDto } from '@/api/generated';
import { billingChip, billingUnit, formatMoney } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type PackageCardProps = {
  pack: PublicProfilePackageDto;
  /** Fixed width for a carousel card; omit to fill the parent. */
  width?: number;
  /** False while payments are hidden: the price and its period unit are left out. */
  showPrices: boolean;
  /** When set, the card is a radio option: a round check shows beside the price and a tap calls this. */
  onSelect?: () => void;
  /** Whether this option is the chosen one; only meaningful with `onSelect`. */
  selected?: boolean;
  /** A discount name shown as a pill; the price then reads as the discounted, highlighted one. */
  discountLabel?: string;
  /** Greys the option out while a request is being sent. */
  disabled?: boolean;
};

/** One package on a coach profile: name, billing type, price and what it includes; selectable in the request sheet. */
export function PackageCard({ pack, width, showPrices, onSelect, selected = false, disabled = false, discountLabel }: PackageCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const description = pack.description?.trim();

  const selectable = onSelect !== undefined;
  const check = selectable ? (
    <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]} accessibilityElementsHidden>
      {selected ? (
        <SymbolView name="checkmark" tintColor={theme.colors.onPrimary} size={theme.sizes.checkGlyph} weight="bold" />
      ) : null}
    </View>
  ) : null;

  const content = (
    <>
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
      {discountLabel ? (
        <View style={styles.pill}>
          <Text variant="chipSmall" color="nutritionInk">
            {discountLabel}
          </Text>
        </View>
      ) : null}
      {showPrices || check ? (
        <View style={styles.priceRow}>
          {showPrices ? (
            <>
              <Text variant="display" color={discountLabel ? 'nutritionInk' : 'ink'}>
                {formatMoney(pack.price, pack.currency, i18n.language)}
              </Text>
              <Text variant="bodySmall" color="muted">
                {billingUnit(t, pack.billing, pack.intervalWeeks)}
              </Text>
            </>
          ) : null}
          {check}
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
    </>
  );

  if (selectable) {
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        accessibilityLabel={pack.name}
        disabled={disabled}
        onPress={onSelect}
        style={[styles.card, selected && styles.cardSelected, disabled && styles.disabled, { width }]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessible accessibilityLabel={pack.name} style={[styles.card, { width }]}>
      {content}
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
    cardSelected: {
      borderWidth: theme.sizes.selectionRing,
      borderColor: theme.colors.ink,
      // The thicker ring grows inward, so the padding gives back the extra width to keep the content still.
      padding: theme.spacing.cardInset - (theme.sizes.selectionRing - theme.sizes.border),
    },
    disabled: {
      opacity: theme.opacity.disabled,
    },
    check: {
      width: theme.sizes.checkCircle,
      height: theme.sizes.checkCircle,
      marginLeft: 'auto',
      alignSelf: 'center',
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: {
      backgroundColor: theme.colors.primary,
    },
    checkOff: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.stepRing,
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
