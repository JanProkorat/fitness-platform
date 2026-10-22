import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type MetricInputProps = {
  label: string;
  /** Unit shown inside the field, such as "kg". */
  unit: string;
  /** Muted line under the field, such as "Last 72.4 kg". */
  hint: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Red border when the typed text is not a usable number. */
  invalid: boolean;
  /** `hero` is the large stacked field, `row` the compact one inside a card. */
  variant: 'hero' | 'row';
  autoFocus?: boolean;
  /** iOS only: the InputAccessoryView shown above this field's keyboard. */
  inputAccessoryViewID?: string;
};

/** Keeps digits and the two decimal separators only. */
const cleanNumber = (text: string): string => text.replace(/[^0-9.,]/g, '');

/** A numeric field with its unit and "last value" hint. */
export function MetricInput({
  label,
  unit,
  hint,
  value,
  onChangeText,
  invalid,
  variant,
  autoFocus,
  inputAccessoryViewID,
}: MetricInputProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  const hero = variant === 'hero';
  const borderColor = invalid
    ? theme.colors.error
    : focused
      ? theme.colors.ink
      : 'transparent';

  const field = (
    <View style={hero ? styles.heroBox : styles.rowBox}>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(cleanNumber(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`${label}, ${unit}`}
        accessibilityHint={hint}
        keyboardType="decimal-pad"
        placeholder="—"
        placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.accent}
        autoFocus={autoFocus}
        inputAccessoryViewID={inputAccessoryViewID}
        maxLength={7}
        style={[hero ? styles.heroInput : styles.rowInput, { borderColor }]}
      />
      <Text
        variant={hero ? 'body' : 'label'}
        color="muted"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={hero ? styles.heroUnit : styles.rowUnit}
      >
        {unit}
      </Text>
    </View>
  );

  if (hero) {
    return (
      <View style={styles.hero}>
        <Text variant="label" color="muted">
          {label}
        </Text>
        {field}
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color="muted">
          {hint}
        </Text>
      </View>
      {field}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    hero: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.snug,
    },
    heroBox: {
      height: theme.sizes.metricHeroField,
      justifyContent: 'center',
    },
    heroInput: {
      ...theme.typography.title,
      height: theme.sizes.metricHeroField,
      paddingLeft: theme.spacing.xl,
      paddingRight: theme.spacing.huge + theme.spacing.xs,
      borderRadius: theme.radii.lg,
      borderWidth: theme.sizes.borderStrong,
      backgroundColor: theme.colors.field,
      color: theme.colors.ink,
    },
    heroUnit: {
      position: 'absolute',
      right: theme.spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    rowCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xxs / 2,
    },
    rowBox: {
      width: theme.sizes.metricRowFieldWidth,
      height: theme.sizes.metricRowField,
      justifyContent: 'center',
    },
    rowInput: {
      ...theme.typography.button,
      height: theme.sizes.metricRowField,
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.huge + theme.spacing.xxs,
      borderRadius: theme.radii.md,
      borderWidth: theme.sizes.borderStrong,
      backgroundColor: theme.colors.field,
      color: theme.colors.ink,
      textAlign: 'right',
    },
    rowUnit: {
      position: 'absolute',
      right: theme.spacing.md,
    },
  });
