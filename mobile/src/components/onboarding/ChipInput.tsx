import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { OptionalPill } from '@/components/onboarding/OptionalPill';
import { TagChip } from '@/components/onboarding/TagChip';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type ChipInputProps = {
  label: string;
  addLabel: string;
  items: string[];
  onRemove: (index: number) => void;
  /** Opens the sheet where entries are typed. */
  onAdd: () => void;
};

/** An optional chip list: its entries plus a dashed "Add" chip that opens the sheet. */
export function ChipInput({ label, addLabel, items, onRemove, onAdd }: ChipInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="body" color="muted" style={styles.label}>
          {label}
        </Text>
        <OptionalPill />
      </View>
      <View style={styles.chips}>
        {items.map((item, index) => (
          <TagChip
            key={item}
            label={item}
            removeLabel={t('onboarding.removeItem', { item })}
            onRemove={() => onRemove(index)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          onPress={onAdd}
          style={styles.add}
        >
          <SymbolView name="plus" weight="medium" tintColor={theme.colors.muted} size={theme.sizes.stepGlyph} />
          <Text variant="body" color="muted">
            {addLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    label: {
      flex: 1,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: theme.spacing.xs,
      height: theme.sizes.chip,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.radii.pill,
      borderWidth: theme.sizes.border,
      borderStyle: 'dashed',
      borderColor: theme.colors.muted,
    },
  });
