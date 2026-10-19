import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { Text } from './Text';

type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
};

/** Consent-style checkbox with a wrapping label. */
export function Checkbox({ label, checked, onChange, error }: CheckboxProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={styles.row}
      >
        <View
          style={[
            styles.box,
            checked ? styles.boxChecked : error ? styles.boxError : styles.boxEmpty,
          ]}
        >
          {checked ? (
            <SymbolView
              name="checkmark"
              weight="bold"
              tintColor={theme.colors.onPrimary}
              size={theme.sizes.checkboxGlyph}
            />
          ) : null}
        </View>
        <Text variant="label" color="muted" style={styles.label}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      gap: theme.spacing.xxs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
    },
    box: {
      width: theme.sizes.checkbox,
      height: theme.sizes.checkbox,
      borderRadius: theme.radii.checkbox,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: {
      backgroundColor: theme.colors.primary,
    },
    boxEmpty: {
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.fieldBorder,
      backgroundColor: theme.colors.field,
    },
    boxError: {
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.error,
      backgroundColor: theme.colors.field,
    },
    label: {
      flex: 1,
    },
  });
