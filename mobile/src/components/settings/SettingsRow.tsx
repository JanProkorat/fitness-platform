import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

type SettingsRowProps = {
  label: string;
  /** Muted value on the right, such as the current language. */
  value?: string;
  /** Element on the right instead of a value, such as a switch. */
  trailing?: ReactNode;
  /** Red label for actions that end the session or the account. */
  destructive?: boolean;
  /** Shows a chevron when the row has a handler; a row without one is read-only. */
  onPress?: () => void;
};

/** One row of a settings card: label, then a value, a switch or a chevron. */
export function SettingsRow({ label, value, trailing, destructive, onPress }: SettingsRowProps) {
  const theme = useTheme();
  const styles = makeStyles(theme);

  const content = (
    <>
      <Text
        variant="body"
        color={destructive ? 'error' : 'ink'}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Text>
      {value ? (
        <Text variant="bodySmall" color="muted" numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {onPress && !destructive ? (
        <SymbolView
          name="chevron.right"
          weight="medium"
          tintColor={theme.colors.muted}
          size={theme.sizes.listChevron}
        />
      ) : null}
    </>
  );

  if (!onPress) {
    return (
      <View accessible={!trailing} accessibilityLabel={value ? `${label}, ${value}` : label} style={styles.row}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={styles.row}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      minHeight: theme.sizes.tabItem,
      paddingVertical: theme.spacing.md,
    },
    label: {
      flex: 1,
    },
    value: {
      flexShrink: 1,
    },
  });
