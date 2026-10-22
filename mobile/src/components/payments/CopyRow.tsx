import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/Text';
import { useTheme } from '@/theme';
import type { Theme } from '@/theme';

const COPIED_MS = 1600;

type CopyRowProps = {
  label: string;
  /** What is shown. */
  value: string;
  /** What lands on the clipboard; defaults to the shown value. */
  copyValue?: string;
  divider?: boolean;
};

/** One payment detail with a copy button; the value is never logged. */
export function CopyRow({ label, value, copyValue, divider = false }: CopyRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = makeStyles(theme);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(copyValue ?? value);
    } catch {
      // A failed copy leaves the visible value selectable by eye; there is nothing to report.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.copy}>
        <Text variant="caption" color="muted">
          {label}
        </Text>
        <Text variant="body" style={styles.value} selectable>
          {value}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? t('payments.copied') : t('payments.copy', { label })}
        hitSlop={theme.spacing.xxs}
        onPress={() => void copy()}
        style={styles.button}
      >
        <SymbolView
          name={copied ? 'checkmark' : 'doc.on.doc'}
          tintColor={copied ? theme.colors.success : theme.colors.muted}
          size={theme.sizes.copyGlyph}
        />
      </Pressable>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    divider: {
      borderTopWidth: theme.sizes.border,
      borderTopColor: theme.colors.lineStrong,
    },
    copy: {
      flex: 1,
      minWidth: 0,
    },
    value: {
      fontVariant: ['tabular-nums'],
    },
    button: {
      width: theme.sizes.copyButton,
      height: theme.sizes.copyButton,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
