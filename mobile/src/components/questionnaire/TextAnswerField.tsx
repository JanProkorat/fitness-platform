import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { SHORT_TEXT_MAX_LENGTH } from '@/components/questionnaire/fillModel';
import type { FieldProps } from '@/components/questionnaire/fieldProps';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** short_text: a roomy multi-line box. */
export function TextAnswerField({ question, draft, onChange }: FieldProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      accessibilityLabel={question.label}
      value={draft.text}
      onChangeText={(text) => onChange({ text })}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      maxLength={SHORT_TEXT_MAX_LENGTH}
      multiline
      textAlignVertical="top"
      placeholderTextColor={theme.colors.muted}
      selectionColor={theme.colors.accent}
      style={[styles.box, { borderColor: focused ? theme.colors.ink2 : theme.colors.fieldBorder }]}
    />
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      ...theme.typography.bodyLarge,
      minHeight: theme.sizes.messageField,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radii.xl,
      borderWidth: theme.sizes.border,
      backgroundColor: theme.colors.field,
      color: theme.colors.ink,
    },
  });
