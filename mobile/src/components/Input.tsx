import { useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

import { Text } from './Text';

type InputProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  /** Rendered before the text, inside the field (e.g. an icon). */
  leading?: ReactNode;
  /** Rendered after the text, inside the field (e.g. a Show/Hide toggle). */
  trailing?: ReactNode;
  inputRef?: RefObject<TextInput | null>;
};

export function Input({
  label,
  error,
  leading,
  trailing,
  inputRef,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);
  const fallbackRef = useRef<TextInput>(null);
  const fieldRef = inputRef ?? fallbackRef;
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
      <Pressable
        accessible={false}
        onPress={() => fieldRef.current?.focus()}
        style={[styles.field, { borderColor }]}
      >
        {leading}
        <TextInput
          {...rest}
          ref={fieldRef}
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
          style={styles.text}
        />
        {trailing}
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
      gap: theme.spacing.snug,
    },
    field: {
      height: theme.sizes.field,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radii.field,
      borderWidth: theme.sizes.border,
      backgroundColor: theme.colors.field,
    },
    text: {
      ...theme.typography.bodyLarge,
      flex: 1,
      height: '100%',
      padding: 0,
      color: theme.colors.ink,
    },
  });
