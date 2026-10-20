import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type MessageBubbleProps = {
  text: string;
  /** Sent by the signed-in client: right-aligned and filled with the accent. */
  own: boolean;
};

export function MessageBubble({ text, own }: MessageBubbleProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  return (
    <View style={[styles.bubble, own ? styles.own : styles.other]}>
      <Text variant="bodyLarge" style={{ color: own ? theme.colors.onAccent : theme.colors.ink }}>
        {text}
      </Text>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: theme.spacing.xxl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radii.xxl,
    },
    own: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.accent,
    },
    other: {
      alignSelf: 'flex-start',
      borderWidth: theme.sizes.border,
      borderColor: theme.colors.line,
      backgroundColor: theme.colors.surface,
      boxShadow: theme.shadows.card,
    },
  });
