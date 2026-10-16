import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { Text } from './Text';

type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
};

export function Input({ label, error, onFocus, onBlur, ...rest }: InputProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? theme.colors.error
    : focused
      ? theme.colors.ink2
      : theme.colors.fieldBorder;

  return (
    <View style={styles.root}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <TextInput
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.muted}
        selectionColor={theme.colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.field, { borderColor }]}
      />
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
    field: {
      ...theme.typography.body,
      height: theme.sizes.field,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      backgroundColor: theme.colors.field,
      color: theme.colors.ink,
    },
  });
