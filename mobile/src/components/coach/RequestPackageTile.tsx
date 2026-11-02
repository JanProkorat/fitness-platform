import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import type { PublicProfilePackageDto } from '@/api/generated';
import { billingChip, billingUnit, formatMoney } from '@/components/payments/format';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type RequestPackageTileProps = {
  pack: PublicProfilePackageDto;
  selected: boolean;
  /** False while payments are hidden: the price and its period unit are left out. */
  showPrices: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** One selectable package in the request sheet: name, billing type and price. */
export function RequestPackageTile({ pack, selected, showPrices, disabled = false, onPress }: RequestPackageTileProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={pack.name}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected && styles.selected, pressed && styles.pressed]}
    >
      <View style={styles.copy}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {pack.name}
        </Text>
        <View style={styles.meta}>
          <View style={styles.chip}>
            <Text variant="chipSmall" color="ink2">
              {billingChip(t, pack.billing, pack.intervalWeeks)}
            </Text>
          </View>
          {showPrices ? (
            <Text variant="bodySmall" color="muted">
              {formatMoney(pack.price, pack.currency, i18n.language)} {billingUnit(t, pack.billing, pack.intervalWeeks)}
            </Text>
          ) : null}
        </View>
      </View>
      <SymbolView
        name={selected ? 'checkmark.circle.fill' : 'circle'}
        tintColor={selected ? theme.colors.ink : theme.colors.lineStrong}
        size={theme.sizes.rowGlyph}
      />
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    tile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.lg,
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.field,
    },
    selected: {
      borderWidth: theme.sizes.borderStrong,
      borderColor: theme.colors.ink,
      backgroundColor: theme.colors.surface,
    },
    pressed: {
      opacity: theme.opacity.pressedRow,
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.hair,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    chip: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.hair,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.line,
    },
  });
