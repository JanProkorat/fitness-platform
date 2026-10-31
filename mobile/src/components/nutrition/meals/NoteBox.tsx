import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

/** The note's text without surrounding whitespace, or undefined when there is nothing to show. */
export function trimmedNote(note: string | null | undefined): string | undefined {
  const text = note?.trim();
  return text ? text : undefined;
}

type NoteBoxProps = {
  label: string;
  note: string | null | undefined;
  /** Soft filled box (inside an open meal) or a bare line (inside a card, under a divider). */
  plain?: boolean;
};

/** A coach note: bubble glyph, bold label, then the full note text. Renders nothing for an empty note. */
export function NoteBox({ label, note, plain = false }: NoteBoxProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const text = trimmedNote(note);
  if (!text) return null;

  return (
    <View style={[styles.box, !plain && styles.soft]}>
      <SymbolView name="text.bubble" weight="medium" tintColor={theme.colors.muted} size={theme.sizes.noteGlyph} />
      <Text variant="bodySmall" style={styles.text}>
        <Text variant="link">{label}</Text>
        <Text variant="bodySmall" color="muted">
          {` · ${text}`}
        </Text>
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.xs,
    },
    soft: {
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.field,
      marginVertical: theme.spacing.snug,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
  });
